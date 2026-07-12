import { NextRequest, NextResponse } from "next/server";
import { retrieveCharge } from "@/lib/omise";
import { getTransactionByChargeId, finalizeTransaction } from "@/lib/db/payment";
import { addCurrency } from "@/lib/db/player";

/**
 * Omise webhook receiver — this is what actually credits async (PromptPay)
 * payments once the player scans the QR. Omise does NOT cryptographically
 * sign webhook payloads the way Stripe does, so this handler never trusts
 * the payload's own stated status — it only reads the charge id out of the
 * event, then independently re-fetches that charge from Omise directly
 * (retrieveCharge, secret-key auth) as the actual verification step.
 *
 * Always responds 200 (even on a charge id we don't recognize, or one that's
 * already finalized) so Omise doesn't retry-storm us — webhook redelivery is
 * expected and handled by finalizeTransaction()'s pending-only guard, which
 * makes crediting idempotent regardless of how many times this fires for the
 * same charge.
 */
export async function POST(req: NextRequest) {
  let chargeId: string | undefined;
  try {
    const body = await req.json();
    chargeId = body?.data?.id ?? body?.id;
  } catch {
    return NextResponse.json({ received: true });
  }

  if (!chargeId) return NextResponse.json({ received: true });

  const transaction = await getTransactionByChargeId(chargeId);
  if (!transaction || transaction.status !== "pending") return NextResponse.json({ received: true });

  try {
    const charge = await retrieveCharge(chargeId);
    if (charge.status === "successful") {
      const wonRace = await finalizeTransaction(transaction.id, "successful");
      if (wonRace) await addCurrency(transaction.playerId, { ticket: transaction.ticketAmount });
    } else if (charge.status === "failed" || charge.status === "expired") {
      await finalizeTransaction(transaction.id, "failed");
    }
  } catch (e) {
    console.error("Omise webhook processing failed:", (e as Error).message);
  }

  return NextResponse.json({ received: true });
}
