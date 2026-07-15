import { getSupabaseClient } from "../supabase/client";
import { addCurrency } from "../db/player";
import { getStageById } from "./stage";
import { grantEquipmentToPlayer, unlockCharacterForPlayer } from "../db/inventory";
import { addGreenBanknotes, markWithdrawalProcessed, getWithdrawalRequestById } from "../db/income";

const MAIL_TABLE = "mailbox";
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
  id: string; // mailbox row id, used to claim
  playerId: string;
  title: string;
  message: string;
  reward: string; // format: "type:amountOrId" e.g. "coin:100", "equipment:helmet_common"
  claimed: boolean;
  /** ISO timestamp of when this mail was sent. */
  sentAt: string;
}

function rowToMail(r: Record<string, unknown>): MailItem {
  return {
    id: String(r.id),
    playerId: String(r.player_id),
    title: String(r.title || ""),
    message: String(r.message || ""),
    reward: String(r.reward || ""),
    claimed: Boolean(r.claimed),
    sentAt: String(r.sent_at || ""),
  };
}

/** Deletes every already-claimed mail row older than MAIL_EXPIRY_MS, across
 *  every player — called before every mailbox read so the table never grows
 *  unbounded. Unclaimed rows are never touched. */
async function purgeExpiredMail(): Promise<void> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - MAIL_EXPIRY_MS).toISOString();
  const { error } = await supabase.from(MAIL_TABLE).delete().eq("claimed", true).lt("sent_at", cutoff);
  if (error) throw new Error(`purgeExpiredMail: ${error.message}`);
}

export async function getMailForPlayer(playerId: string): Promise<MailItem[]> {
  await purgeExpiredMail();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(MAIL_TABLE).select("*").eq("player_id", playerId).order("sent_at", { ascending: false });
  if (error) throw new Error(`getMailForPlayer: ${error.message}`);
  return (data ?? []).map(rowToMail);
}

export async function sendMail(playerId: string, title: string, message: string, reward: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(MAIL_TABLE).insert({ player_id: playerId, title, message, reward, claimed: false, sent_at: new Date().toISOString() });
  if (error) throw new Error(`sendMail: ${error.message}`);
}

async function getMailById(id: string): Promise<MailItem | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(MAIL_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getMailById: ${error.message}`);
  return data ? rowToMail(data) : null;
}

export async function claimMail(playerId: string, id: string): Promise<{ coin: number; exp: number; ticket: number; diamond: number; banknote: number; itemGranted?: string }> {
  const row = await getMailById(id);
  if (!row || row.playerId !== playerId) throw new Error("Mail not found");
  if (row.claimed) throw new Error("Already claimed");

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

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(MAIL_TABLE).update({ claimed: true }).eq("id", id);
  if (error) throw new Error(`claimMail (update): ${error.message}`);
  return result;
}

/**
 * Admin-only counterpart to claimMail() for "withdrawal:<requestId>" mail —
 * ticking this off means the admin already sent the real TrueMoney transfer
 * by hand. Marks the request processed, checks this admin-mailbox entry off,
 * and mails the original requester a confirmation.
 */
export async function approveWithdrawalMail(adminId: string, id: string): Promise<{ playerId: string; amount: number }> {
  const row = await getMailById(id);
  if (!row || row.playerId !== adminId) throw new Error("Mail not found");
  if (row.claimed) throw new Error("Already handled");

  const [type, requestId] = row.reward.split(":");
  if (type !== "withdrawal") throw new Error("Not a withdrawal request");

  const request = await getWithdrawalRequestById(requestId);
  if (!request) throw new Error("Withdrawal request not found");

  await markWithdrawalProcessed(requestId);
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(MAIL_TABLE).update({ claimed: true }).eq("id", id);
  if (error) throw new Error(`approveWithdrawalMail (update): ${error.message}`);

  await sendMail(
    request.playerId,
    "Withdrawal Complete",
    `Your withdrawal of ฿${request.amount} to ${request.phone} has been sent — check your TrueMoney wallet.`,
    ""
  );

  return { playerId: request.playerId, amount: request.amount };
}
