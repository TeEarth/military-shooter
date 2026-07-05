import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerIncome, getWithdrawalRequests } from "@/lib/google/income";
import { getAllTopUpPackages } from "@/lib/google/topup";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [income, requests, topUpPackages] = await Promise.all([
    getPlayerIncome(session.user.id),
    getWithdrawalRequests(session.user.id),
    getAllTopUpPackages(),
  ]);

  return NextResponse.json({ success: true, data: { income, requests, topUpPackages } });
}
