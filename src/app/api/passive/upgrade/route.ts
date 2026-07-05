import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upgradePassive, type PassiveId } from "@/lib/google/passive";
import { toPublicPlayer, getPlayerById } from "@/lib/google/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { passiveId } = (await req.json()) as { passiveId: PassiveId };

  try {
    const result = await upgradePassive(session.user.id, passiveId);
    const player = await getPlayerById(session.user.id);
    return NextResponse.json({ success: true, ...result, updatedPlayer: player ? toPublicPlayer(player) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
