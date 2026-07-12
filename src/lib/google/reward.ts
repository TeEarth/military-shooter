import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, readSheetRaw, updateRow, deleteRowsWhere, parseBool } from "./sheet";
import { addCurrency } from "../db/player";
import { getStageById } from "./stage";
import { grantEquipmentToPlayer, unlockCharacterForPlayer } from "../db/inventory";
import { addGreenBanknotes, markWithdrawalProcessed, getWithdrawalRequestById } from "../db/income";

const MAIL_SHEET = "Mail";
/** v22: mail older than this (and already claimed) is auto-purged so the
 *  mailbox doesn't accumulate clutter forever — unclaimed rewards are NEVER
 *  auto-deleted no matter how old, since that would silently destroy
 *  currency/items the player hasn't collected yet. */
const MAIL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ---------- Stage completion rewards ----------

export interface GrantedReward {
  coin: number;
  exp: number;
}

export async function grantStageCompletionReward(playerId: string, stageId: string): Promise<GrantedReward> {
  const stage = await getStageById(stageId);
  if (!stage) throw new Error("Stage not found");

  const coin = stage.rewardCoin;
  const exp = stage.rewardExp;

  await addCurrency(playerId, { coin, exp });

  return { coin, exp };
}

// ---------- Mail ----------

export interface MailItem {
  index: number; // data row index within the Mail sheet, used to claim
  playerId: string;
  title: string;
  message: string;
  reward: string; // format: "type:amountOrId" e.g. "coin:100", "equipment:helmet_common"
  claimed: boolean;
  /** ISO timestamp of when this mail was sent — blank for mail sent before
   *  v22 added this column. */
  sentAt: string;
}

/** Deletes every already-claimed mail row older than MAIL_EXPIRY_MS, across
 *  every player — called before every mailbox read so the sheet never grows
 *  unbounded. Rows with no sentAt (pre-v22) or unclaimed rows are left alone. */
async function purgeExpiredMail(): Promise<void> {
  const now = Date.now();
  const removed = await deleteRowsWhere(MAIL_SHEET, (r) => {
    if (!parseBool(r.claimed)) return false;
    if (!r.sentAt) return false;
    const sentTime = Date.parse(r.sentAt);
    if (Number.isNaN(sentTime)) return false;
    return now - sentTime > MAIL_EXPIRY_MS;
  });
  if (removed > 0) invalidateSheetCache(MAIL_SHEET);
}

export async function getMailForPlayer(playerId: string): Promise<MailItem[]> {
  await purgeExpiredMail();
  const { rows } = await getCachedSheet(MAIL_SHEET);
  return rows
    .map((row, index) => ({ index, playerId: row.playerId, title: row.title, message: row.message, reward: row.reward, claimed: parseBool(row.claimed), sentAt: row.sentAt || "" }))
    .filter((m) => m.playerId === playerId)
    // Newest first — sentAt is an ISO string, so plain string comparison sorts
    // chronologically; blank (pre-v22) timestamps sort last.
    .sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || ""));
}

export async function sendMail(playerId: string, title: string, message: string, reward: string): Promise<void> {
  await appendRow(MAIL_SHEET, { playerId, title, message, reward, claimed: false, sentAt: new Date().toISOString() });
  invalidateSheetCache(MAIL_SHEET);
}

export async function claimMail(playerId: string, index: number): Promise<{ coin: number; exp: number; ticket: number; diamond: number; banknote: number; itemGranted?: string }> {
  const { rows } = await readSheetRaw(MAIL_SHEET);
  const row = rows[index];
  if (!row || row.playerId !== playerId) throw new Error("Mail not found");
  if (parseBool(row.claimed)) throw new Error("Already claimed");

  const [type, value] = row.reward.split(":");
  const result = { coin: 0, exp: 0, ticket: 0, diamond: 0, banknote: 0, itemGranted: undefined as string | undefined };

  switch (type) {
    case "coin": result.coin = Number(value); await addCurrency(playerId, { coin: Number(value) }); break;
    case "ticket": result.ticket = Number(value); await addCurrency(playerId, { ticket: Number(value) }); break;
    case "diamond": result.diamond = Number(value); await addCurrency(playerId, { diamond: Number(value) }); break;
    case "exp": result.exp = Number(value); await addCurrency(playerId, { exp: Number(value) }); break;
    // v16: leaderboard top-3 weekly rewards are delivered this way — claimed
    // from the mailbox like every other reward, rather than granted silently.
    case "banknote": result.banknote = Number(value); await addGreenBanknotes(playerId, Number(value)); break;
    case "equipment": await grantEquipmentToPlayer(playerId, value); result.itemGranted = value; break;
    case "character": await unlockCharacterForPlayer(playerId, value); result.itemGranted = value; break;
  }

  await updateRow(MAIL_SHEET, index, { claimed: true });
  invalidateSheetCache(MAIL_SHEET);
  return result;
}

/**
 * Admin-only counterpart to claimMail() for "withdrawal:<requestId>" mail —
 * ticking this off means the admin already sent the real TrueMoney transfer
 * by hand. Marks the request processed, checks this admin-mailbox entry off,
 * and mails the original requester a confirmation.
 */
export async function approveWithdrawalMail(adminId: string, index: number): Promise<{ playerId: string; amount: number }> {
  const { rows } = await readSheetRaw(MAIL_SHEET);
  const row = rows[index];
  if (!row || row.playerId !== adminId) throw new Error("Mail not found");
  if (parseBool(row.claimed)) throw new Error("Already handled");

  const [type, requestId] = row.reward.split(":");
  if (type !== "withdrawal") throw new Error("Not a withdrawal request");

  const request = await getWithdrawalRequestById(requestId);
  if (!request) throw new Error("Withdrawal request not found");

  await markWithdrawalProcessed(requestId);
  await updateRow(MAIL_SHEET, index, { claimed: true });
  invalidateSheetCache(MAIL_SHEET);

  await sendMail(
    request.playerId,
    "Withdrawal Complete",
    `Your withdrawal of ฿${request.amount} to ${request.phone} has been sent — check your TrueMoney wallet.`,
    ""
  );

  return { playerId: request.playerId, amount: request.amount };
}
