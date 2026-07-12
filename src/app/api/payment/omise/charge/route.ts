import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllTopUpPackages } from "@/lib/google/topup";
import { createCardCharge, createPromptPayCharge } from "@/lib/omise";
import { createPendingTransaction, finalizeTransaction } from "@/lib/db/payment";
import { addCurrency } from "@/lib/db/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId, method, cardToken } = (await req.json()) as { packageId: string; method: "card" | "promptpay"; cardToken?: string };

  if (method !== "card" && method !== "promptpay") {
    return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
  }
  if (method === "card" && !cardToken) {
    return NextResponse.json({ error: "Missing card token" }, { status: 400 });
  }

  // Price/ticket amount are resolved server-side from the package catalog —
  // the client only ever names WHICH package it wants, never how much to
  // charge, closing the obvious "tamper the amount in devtools" hole.
  const packages = await getAllTopUpPackages();
  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) return NextResponse.json({ error: "Top-up package not found" }, { status: 404 });

  const amountSatang = Math.round(pkg.priceBaht * 100);
  const description = `Top-up: ${pkg.id} (${pkg.ticketAmount} tickets) for player ${session.user.id}`;

  try {
    const charge = method === "card"
      ? await createCardCharge(amountSatang, cardToken!, description)
      : await createPromptPayCharge(amountSatang, description);

    const transaction = await createPendingTransaction({
      playerId: session.user.id,
      packageId: pkg.id,
      omiseChargeId: charge.id,
      amountSatang,
      ticketAmount: pkg.ticketAmount,
      paymentMethod: method,
    });

    // Card charges usually resolve synchronously — credit immediately if so.
    // PromptPay is always async; it stays "pending" until the webhook (or the
    // client's status poll, as a fallback) confirms it via retrieveCharge().
    if (charge.status === "successful") {
      const wonRace = await finalizeTransaction(transaction.id, "successful");
      if (wonRace) await addCurrency(session.user.id, { ticket: pkg.ticketAmount });
    } else if (charge.status === "failed") {
      await finalizeTransaction(transaction.id, "failed");
    }

    return NextResponse.json({
      success: true,
      transactionId: transaction.id,
      status: charge.status,
      qrImageUrl: charge.qrImageUrl,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
