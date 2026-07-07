import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, readSheetRaw, updateRow, parseBool } from "./sheet";
import { addCurrency } from "../db/player";
import { getStageById } from "./stage";
import { grantEquipmentToPlayer, unlockCharacterForPlayer } from "../db/inventory";
import { addGreenBanknotes } from "../db/income";

const MAIL_SHEET = "Mail";

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
}

export async function getMailForPlayer(playerId: string): Promise<MailItem[]> {
  const { rows } = await getCachedSheet(MAIL_SHEET);
  return rows
    .map((row, index) => ({ index, playerId: row.playerId, title: row.title, message: row.message, reward: row.reward, claimed: parseBool(row.claimed) }))
    .filter((m) => m.playerId === playerId);
}

export async function sendMail(playerId: string, title: string, message: string, reward: string): Promise<void> {
  await appendRow(MAIL_SHEET, { playerId, title, message, reward, claimed: false });
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
