import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { mockTopUp } from "@/lib/google/topup";
import { getPlayerById, toPublicPlayer } from "@/lib/google/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { packageId } = await req.json();

  try {
    const result = await mockTopUp(session.user.id, packageId);
    const player = await getPlayerById(session.user.id);
    return NextResponse.json({ success: true, message: `Mock payment successful! +${result.ticketAmount} tickets`, result, player: player ? toPublicPlayer(player) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
