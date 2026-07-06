import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addCurrency } from "@/lib/db/player";

/**
 * Mock payment endpoint. No real payment gateway is connected yet.
 * Calling this immediately grants diamonds so the client purchase flow can be
 * built and tested end-to-end. Swap the body of this handler for a real
 * payment gateway webhook (Stripe, Omise, TrueMoney, etc.) later.
 *
 * VIP level is currently a manual field on the Players sheet (no auto-formula
 * yet) — top up doesn't touch it. Set `vipLevel` directly in the sheet until
 * a VIP formula is defined.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId, diamondAmount } = await req.json();

  if (!diamondAmount || diamondAmount <= 0) {
    return NextResponse.json({ error: "Invalid diamond amount" }, { status: 400 });
  }

  const player = await addCurrency(session.user.id, { diamond: diamondAmount });

  return NextResponse.json({
    success: true,
    message: `Mock payment successful! +${diamondAmount} diamonds`,
    diamond: player.diamond,
    packageId: packageId ?? null,
  });
}
