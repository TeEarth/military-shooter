import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/db/player";
import { joinQueue, leaveQueue, getActiveMatchForPlayer } from "@/lib/db/pvp";

/** Join the matchmaking queue — returns the match immediately if an opponent
 *  was already waiting, or null if this player is now the one waiting (the
 *  client then subscribes to Realtime for the match-found notification). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const match = await joinQueue(player.id, player.username);
  return NextResponse.json({ success: true, match });
}

/** Poll fallback / reconnect check — also used right after subscribing to
 *  Realtime to cover the race where a match was created between POST and the
 *  subscription actually going live. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const match = await getActiveMatchForPlayer(session.user.id);
  return NextResponse.json({ success: true, match });
}

/** Cancel matchmaking (e.g. player navigates away while waiting). */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await leaveQueue(session.user.id);
  return NextResponse.json({ success: true });
}
