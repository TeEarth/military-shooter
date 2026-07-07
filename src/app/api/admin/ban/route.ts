import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePlayer } from "@/lib/db/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { playerId, banned } = (await req.json()) as { playerId: string; banned: boolean };
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  // An admin banning themselves would lock them out immediately (login
  // checks isBanned) with no one left to undo it.
  if (playerId === session.user.id) {
    return NextResponse.json({ error: "Cannot ban your own admin account" }, { status: 400 });
  }

  await updatePlayer(playerId, { isBanned: Boolean(banned) });
  return NextResponse.json({ success: true });
}
