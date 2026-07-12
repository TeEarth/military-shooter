import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTransactionById, finalizeTransaction } from "@/lib/db/payment";
import { retrieveCharge } from "@/lib/omise";
import { addCurrency } from "@/lib/db/player";

/**
 * Polled by the client while waiting on a PromptPay QR scan. Doubles as a
 * fallback verifier (not just a passive read) — if the row is still
 * "pending", it independently re-checks the real charge status with Omise
 * (same retrieveCharge() the webhook uses) rather than only waiting on the
 * webhook to arrive, so a slow/missed webhook delivery doesn't strand the
 * player on a "waiting for payment" screen forever.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transactionId = req.nextUrl.searchParams.get("transactionId");
  if (!transactionId) return NextResponse.json({ error: "transactionId required" }, { status: 400 });

  const transaction = await getTransactionById(transactionId);
  if (!transaction) return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  if (transaction.playerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (transaction.status === "pending") {
    const charge = await retrieveCharge(transaction.omiseChargeId);
    if (charge.status === "successful") {
      const wonRace = await finalizeTransaction(transaction.id, "successful");
      if (wonRace) await addCurrency(transaction.playerId, { ticket: transaction.ticketAmount });
    } else if (charge.status === "failed" || charge.status === "expired") {
      await finalizeTransaction(transaction.id, "failed");
    }
  }

  const latest = await getTransactionById(transactionId);
  return NextResponse.json({ success: true, status: latest?.status ?? transaction.status });
}
