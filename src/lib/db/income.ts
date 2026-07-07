import { getSupabaseClient } from "../supabase/client";
// WithdrawalRequest is NOT in the migrated table list (admin-processed,
// stays editable via Google Sheets) — only PlayerIncome's balance moves here.
import { appendRow, findRows, findRow, updateRow, readSheetRaw } from "../google/sheet";
import { getPlayerById, updatePlayer } from "./player";

/** v16: 100 THB/day withdrawal cap — same lazy reset-on-read pattern this
 *  project already uses for daily ammo/mission resets (compare stored date
 *  to today, reset the counter if stale). */
const DAILY_WITHDRAWAL_CAP_BAHT = 100;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  /** v16: TrueMoney wallet number to pay out to. */
  phone: string;
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
 *
 * v16: requires the TrueMoney phone number to pay out to, and enforces a
 * 100 THB/day cap per player (lazy reset-on-read, same pattern as this
 * project's daily ammo/mission resets — requires
 * scripts/sql/003_v16_schema.sql's daily_withdrawn_baht/date columns).
 */
export async function requestWithdrawal(playerId: string, amount: number, phone: string): Promise<WithdrawalRequestRow> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid withdrawal amount");
  if (!phone || phone.trim().length < 9) throw new Error("Enter a valid TrueMoney phone number");

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const today = todayUtc();
  const withdrawnToday = player.dailyWithdrawnDate === today ? player.dailyWithdrawnBaht : 0;
  if (withdrawnToday + amount > DAILY_WITHDRAWAL_CAP_BAHT) {
    throw new Error(`Daily withdrawal limit is ${DAILY_WITHDRAWAL_CAP_BAHT} baht (${DAILY_WITHDRAWAL_CAP_BAHT - withdrawnToday} baht left today)`);
  }

  const income = await getPlayerIncome(playerId);
  if (amount > income.greenBanknoteBalance) throw new Error("Insufficient green banknote balance");

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, green_banknote_balance: income.greenBanknoteBalance - amount, total_withdrawn: income.totalWithdrawn });
  if (error) throw new Error(`requestWithdrawal: ${error.message}`);

  await updatePlayer(playerId, { dailyWithdrawnBaht: withdrawnToday + amount, dailyWithdrawnDate: today });

  const request: WithdrawalRequestRow = { id: genId("wd"), playerId, amount, phone: phone.trim(), status: "pending", requestedAt: new Date().toISOString() };
  await appendRow(WITHDRAWAL_REQUEST_SHEET, request as unknown as Record<string, string | number | boolean>);
  return request;
}

function rowToWithdrawal(r: Record<string, string>): WithdrawalRequestRow {
  return { id: r.id, playerId: r.playerId, amount: Number(r.amount || 0), phone: r.phone || "", status: r.status || "pending", requestedAt: r.requestedAt || "" };
}

export async function getWithdrawalRequests(playerId: string): Promise<WithdrawalRequestRow[]> {
  const rows = await findRows(WITHDRAWAL_REQUEST_SHEET, (r) => r.playerId === playerId);
  return rows.map(rowToWithdrawal).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

/** Admin-only: every withdrawal request across every player, newest first. */
export async function getAllWithdrawalRequests(): Promise<WithdrawalRequestRow[]> {
  const { rows } = await readSheetRaw(WITHDRAWAL_REQUEST_SHEET);
  return rows.map(rowToWithdrawal).sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
}

export async function getWithdrawalRequestById(requestId: string): Promise<WithdrawalRequestRow | null> {
  const found = await findRow(WITHDRAWAL_REQUEST_SHEET, (r) => r.id === requestId);
  return found ? rowToWithdrawal(found.row) : null;
}

/** Admin marks a withdrawal as paid out (after manually sending the TrueMoney transfer). */
export async function markWithdrawalProcessed(requestId: string): Promise<void> {
  const found = await findRow(WITHDRAWAL_REQUEST_SHEET, (r) => r.id === requestId);
  if (!found) throw new Error("Withdrawal request not found");
  if (found.row.status === "processed") throw new Error("Withdrawal request already processed");
  await updateRow(WITHDRAWAL_REQUEST_SHEET, found.rowIndex, { status: "processed" });
}
