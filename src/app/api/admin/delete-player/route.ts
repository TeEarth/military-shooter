import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deletePlayer, getPlayerById } from "@/lib/db/player";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { playerId } = (await req.json()) as { playerId: string };
  if (!playerId) return NextResponse.json({ error: "playerId required" }, { status: 400 });

  // Avoid an admin accidentally locking themselves out via their own delete button.
  if (playerId === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
  }

  const target = await getPlayerById(playerId);
  if (!target) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  await deletePlayer(playerId);
  return NextResponse.json({ success: true });
}
