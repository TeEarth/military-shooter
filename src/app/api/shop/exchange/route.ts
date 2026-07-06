import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exchangeCurrency } from "@/lib/google/exchange";
import { getPlayerById, toPublicPlayer } from "@/lib/db/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { exchangeId } = await req.json();

  try {
    const result = await exchangeCurrency(session.user.id, exchangeId);
    const player = await getPlayerById(session.user.id);
    return NextResponse.json({ success: true, result, player: player ? toPublicPlayer(player) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
