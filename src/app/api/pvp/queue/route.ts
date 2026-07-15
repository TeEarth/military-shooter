import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/db/player";
import { joinQueue, leaveQueue, getActiveMatchForPlayer } from "@/lib/db/pvp";

/** Ticket cost to enter PvP matchmaking — checked here (so a player can't
 *  queue at all without enough tickets) but only actually CHARGED once a
 *  match is found (see match/start/route.ts). v29 fix: this used to deduct
 *  the fee right here at queue-join, which meant cancelling before ever
 *  finding an opponent needed a compensating refund — the user pointed out
 *  that's backwards (should never be charged at all if no match happens),
 *  so the real charge now only happens once a match actually exists. */
const PVP_ENTRY_TICKET_COST = 5;

/** Join the matchmaking queue — returns the match immediately if an opponent
 *  was already waiting, or null if this player is now the one waiting (the
 *  client then subscribes to Realtime for the match-found notification). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Already in an active match (e.g. reconnect) — hand it back, no queueing needed.
  const activeMatch = await getActiveMatchForPlayer(player.id);
  if (activeMatch) return NextResponse.json({ success: true, match: activeMatch });

  if (player.ticket < PVP_ENTRY_TICKET_COST) {
    return NextResponse.json({ error: `Need ${PVP_ENTRY_TICKET_COST} tickets to play PvP` }, { status: 400 });
  }

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

/** Cancel matchmaking (e.g. player navigates away while waiting) — no ticket
 *  was ever charged for just waiting, so there's nothing to refund. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await leaveQueue(session.user.id);
  return NextResponse.json({ success: true });
}
