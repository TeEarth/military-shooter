import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requestWithdrawal } from "@/lib/db/income";
import { getAllPlayers, getPlayerById } from "@/lib/db/player";
import { sendMail } from "@/lib/google/reward";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, phone } = await req.json();

  try {
    const request = await requestWithdrawal(session.user.id, Number(amount), String(phone ?? ""));

    // Withdrawals are the ONLY thing that ever lands in an admin's mailbox —
    // every other admin-facing message flow is the reverse (admin -> player).
    // Delivered to every admin account so any one of them can pick it up and
    // process it; whichever admin ticks it off first marks it processed for
    // everyone (see /api/mailbox's approve_withdrawal action).
    const requester = await getPlayerById(session.user.id);
    const admins = (await getAllPlayers()).filter((p) => p.isAdmin);
    await Promise.all(
      admins.map((admin) =>
        sendMail(
          admin.id,
          "Withdrawal Request",
          `${requester?.username ?? session.user!.id} requested ฿${request.amount} to TrueMoney wallet ${request.phone}. Tick the box once you've sent the transfer.`,
          `withdrawal:${request.id}`
        )
      )
    );

    return NextResponse.json({ success: true, request, message: "Withdrawal request submitted — an admin will process it manually." });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
