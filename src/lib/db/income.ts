import { getSupabaseClient } from "../supabase/client";
// WithdrawalRequest is NOT in the migrated table list (admin-processed,
// stays editable via Google Sheets) — only PlayerIncome's balance moves here.
import { appendRow, findRows } from "../google/sheet";

const TABLE = "player_income";
const WITHDRAWAL_REQUEST_SHEET = "WithdrawalRequest";

export interface PlayerIncomeRow {
  playerId: string;
  greenBanknoteBalance: number;
  totalWithdrawn: number;
}

export async function getPlayerIncome(playerId: string): Promise<PlayerIncomeRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("player_id", playerId).maybeSingle();
  if (error) throw new Error(`getPlayerIncome: ${error.message}`);
  return {
    playerId,
    greenBanknoteBalance: Number(data?.green_banknote_balance ?? 0),
    totalWithdrawn: Number(data?.total_withdrawn ?? 0),
  };
}

/**
 * Green banknotes are the "money the player earned" side of the economy (boss
 * kills, personal-milestone batches) — 1 banknote = 1 THB, redeemable only via
 * a manual withdrawal request (see requestWithdrawal). This is separate from
 * ticket top-up (real money IN) in src/lib/google/topup.ts.
 */
export async function addGreenBanknotes(playerId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  const current = await getPlayerIncome(playerId);
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, green_banknote_balance: current.greenBanknoteBalance + amount, total_withdrawn: current.totalWithdrawn });
  if (error) throw new Error(`addGreenBanknotes: ${error.message}`);
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

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, green_banknote_balance: income.greenBanknoteBalance - amount, total_withdrawn: income.totalWithdrawn });
  if (error) throw new Error(`requestWithdrawal: ${error.message}`);

  const request: WithdrawalRequestRow = { id: genId("wd"), playerId, amount, status: "pending", requestedAt: new Date().toISOString() };
  await appendRow(WITHDRAWAL_REQUEST_SHEET, request as unknown as Record<string, string | number | boolean>);
  return request;
}

export async function getWithdrawalRequests(playerId: string): Promise<WithdrawalRequestRow[]> {
  const rows = await findRows(WITHDRAWAL_REQUEST_SHEET, (r) => r.playerId === playerId);
  return rows
    .map((r) => ({ id: r.id, playerId: r.playerId, amount: Number(r.amount || 0), status: r.status || "pending", requestedAt: r.requestedAt || "" }))
    .sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}
