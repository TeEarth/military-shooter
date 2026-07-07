import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimMail, getMailForPlayer, approveWithdrawalMail } from "@/lib/google/reward";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await getMailForPlayer(session.user.id);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { index, action } = await req.json();

  if (action === "claim") {
    try {
      const result = await claimMail(session.user.id, index);
      return NextResponse.json({ success: true, result });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  if (action === "approve_withdrawal") {
    if (!session.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    try {
      const result = await approveWithdrawalMail(session.user.id, index);
      return NextResponse.json({ success: true, result });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
