import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, findRows, updateRow } from "./sheet";

const PLAYER_INCOME_SHEET = "PlayerIncome";
const WITHDRAWAL_REQUEST_SHEET = "WithdrawalRequest";

export interface PlayerIncomeRow {
  playerId: string;
  greenBanknoteBalance: number;
  totalWithdrawn: number;
}

function rowToIncome(playerId: string, row: Record<string, string> | null): PlayerIncomeRow {
  return {
    playerId,
    greenBanknoteBalance: Number(row?.greenBanknoteBalance || 0),
    totalWithdrawn: Number(row?.totalWithdrawn || 0),
  };
}

export async function getPlayerIncome(playerId: string): Promise<PlayerIncomeRow> {
  const found = await findRow(PLAYER_INCOME_SHEET, (r) => r.playerId === playerId);
  return rowToIncome(playerId, found?.row ?? null);
}

/**
 * Green banknotes are the "money the player earned" side of the economy (boss
 * kills, personal-milestone batches) — 1 banknote = 1 THB, redeemable only via
 * a manual withdrawal request (see requestWithdrawal). This is separate from
 * ticket top-up (real money IN) in src/lib/google/topup.ts.
 */
export async function addGreenBanknotes(playerId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const found = await findRow(PLAYER_INCOME_SHEET, (r) => r.playerId === playerId);
  if (found) {
    const newBalance = Number(found.row.greenBanknoteBalance || 0) + amount;
    await updateRow(PLAYER_INCOME_SHEET, found.rowIndex, { greenBanknoteBalance: newBalance });
  } else {
    await appendRow(PLAYER_INCOME_SHEET, { playerId, greenBanknoteBalance: amount, totalWithdrawn: 0 });
  }
  invalidateSheetCache(PLAYER_INCOME_SHEET);
}

export interface WithdrawalRequestRow {
  id: string;
  playerId: string;
  amount: number;
  status: string;
  requestedAt: string;
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reserves `amount` green banknotes immediately (so the balance can't be
 * double-spent across requests) and logs a "pending" request row for the
 * admin to process manually — this codebase does NOT connect to a real
 * payment/payout provider. See the v4 request doc's cash-out warning.
 */
export async function requestWithdrawal(playerId: string, amount: number): Promise<WithdrawalRequestRow> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid withdrawal amount");

  const income = await getPlayerIncome(playerId);
  if (amount > income.greenBanknoteBalance) throw new Error("Insufficient green banknote balance");

  const found = await findRow(PLAYER_INCOME_SHEET, (r) => r.playerId === playerId);
  const newBalance = income.greenBanknoteBalance - amount;
  if (found) {
    await updateRow(PLAYER_INCOME_SHEET, found.rowIndex, { greenBanknoteBalance: newBalance });
  } else {
    await appendRow(PLAYER_INCOME_SHEET, { playerId, greenBanknoteBalance: newBalance, totalWithdrawn: 0 });
  }
  invalidateSheetCache(PLAYER_INCOME_SHEET);

  const request: WithdrawalRequestRow = { id: genId("wd"), playerId, amount, status: "pending", requestedAt: new Date().toISOString() };
  await appendRow(WITHDRAWAL_REQUEST_SHEET, request as unknown as Record<string, string | number | boolean>);
  invalidateSheetCache(WITHDRAWAL_REQUEST_SHEET);
  return request;
}

export async function getWithdrawalRequests(playerId: string): Promise<WithdrawalRequestRow[]> {
  const rows = await findRows(WITHDRAWAL_REQUEST_SHEET, (r) => r.playerId === playerId);
  return rows
    .map((r) => ({ id: r.id, playerId: r.playerId, amount: Number(r.amount || 0), status: r.status || "pending", requestedAt: r.requestedAt || "" }))
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}
