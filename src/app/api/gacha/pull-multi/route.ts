import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pullGachaMulti } from "@/lib/google/gacha";
import { getPlayerById, toPublicPlayer } from "@/lib/db/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poolId } = await req.json();

  try {
    const results = await pullGachaMulti(session.user.id, poolId);
    const player = await getPlayerById(session.user.id);
    return NextResponse.json({ success: true, results, updatedPlayer: player ? toPublicPlayer(player) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
