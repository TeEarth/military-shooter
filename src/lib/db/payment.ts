import { getSupabaseClient } from "../supabase/client";

const TABLE = "payment_transactions";

export type PaymentMethod = "card" | "promptpay";
export type PaymentStatus = "pending" | "successful" | "failed";

export interface PaymentTransaction {
  id: string;
  playerId: string;
  packageId: string;
  omiseChargeId: string;
  amountSatang: number;
  ticketAmount: number;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
  completedAt: string | null;
}

function rowToTransaction(row: Record<string, unknown>): PaymentTransaction {
  return {
    id: String(row.id),
    playerId: String(row.player_id),
    packageId: String(row.package_id),
    omiseChargeId: String(row.omise_charge_id),
    amountSatang: Number(row.amount_satang),
    ticketAmount: Number(row.ticket_amount),
    paymentMethod: row.payment_method as PaymentMethod,
    status: row.status as PaymentStatus,
    createdAt: String(row.created_at ?? ""),
    completedAt: (row.completed_at as string | null) ?? null,
  };
}

/** Inserts the pending row for a freshly-created Omise charge. The UNIQUE
 *  constraint on omise_charge_id means this can never be inserted twice for
 *  the same charge — that uniqueness IS the anti-duplicate-processing guard. */
export async function createPendingTransaction(params: {
  playerId: string;
  packageId: string;
  omiseChargeId: string;
  amountSatang: number;
  ticketAmount: number;
  paymentMethod: PaymentMethod;
}): Promise<PaymentTransaction> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      player_id: params.playerId,
      package_id: params.packageId,
      omise_charge_id: params.omiseChargeId,
      amount_satang: params.amountSatang,
      ticket_amount: params.ticketAmount,
      payment_method: params.paymentMethod,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw new Error(`createPendingTransaction: ${error.message}`);
  return rowToTransaction(data);
}

export async function getTransactionByChargeId(omiseChargeId: string): Promise<PaymentTransaction | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("omise_charge_id", omiseChargeId).maybeSingle();
  if (error) throw new Error(`getTransactionByChargeId: ${error.message}`);
  return data ? rowToTransaction(data) : null;
}

export async function getTransactionById(id: string): Promise<PaymentTransaction | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getTransactionById: ${error.message}`);
  return data ? rowToTransaction(data) : null;
}

/** Top-up history for the Income page — newest first, capped at 50 rows so a
 *  long-lived account's page load stays fast (this is a display list, not an
 *  export/audit tool). */
export async function getTransactionsForPlayer(playerId: string): Promise<PaymentTransaction[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`getTransactionsForPlayer: ${error.message}`);
  return (data ?? []).map(rowToTransaction);
}

/**
 * Flips a transaction from pending to successful/failed — guarded by
 * `.eq("status", "pending")` so this can never run twice for the same
 * transaction (webhook redelivery, a concurrent status-poll, and the
 * synchronous card-charge path can all call this safely; only the first
 * caller actually transitions the row and gets `true` back).
 */
export async function finalizeTransaction(id: string, status: "successful" | "failed"): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status, completed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`finalizeTransaction: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
