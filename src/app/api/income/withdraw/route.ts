import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requestWithdrawal } from "@/lib/db/income";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount, phone } = await req.json();

  try {
    const request = await requestWithdrawal(session.user.id, Number(amount), String(phone ?? ""));
    return NextResponse.json({ success: true, request, message: "Withdrawal request submitted — an admin will process it manually." });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
