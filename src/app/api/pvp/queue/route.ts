import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency } from "@/lib/db/player";
import { joinQueue, leaveQueue, getActiveMatchForPlayer, isPlayerQueued } from "@/lib/db/pvp";

/** Ticket cost to enter PvP matchmaking — charged on queue join, refunded if
 *  the player cancels (DELETE) before ever being matched. See PVP_WIN_TICKET /
 *  PVP_LOSS_DIAMOND in match/complete/route.ts for the payout side. */
const PVP_ENTRY_TICKET_COST = 5;

/** Join the matchmaking queue — returns the match immediately if an opponent
 *  was already waiting, or null if this player is now the one waiting (the
 *  client then subscribes to Realtime for the match-found notification). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  // Already in an active match (e.g. reconnect) — no new fee, just hand it back.
  const activeMatch = await getActiveMatchForPlayer(player.id);
  if (activeMatch) return NextResponse.json({ success: true, match: activeMatch });

  // The client re-POSTs every 3s while waiting for an opponent (see
  // PvpClient's findMatch() polling) — already having a queue row means the
  // fee was already charged when this player first joined, so skip re-charging.
  const alreadyQueued = await isPlayerQueued(player.id);
  if (!alreadyQueued) {
    if (player.ticket < PVP_ENTRY_TICKET_COST) {
      return NextResponse.json({ error: `Need ${PVP_ENTRY_TICKET_COST} tickets to play PvP` }, { status: 400 });
    }
    await addCurrency(player.id, { ticket: -PVP_ENTRY_TICKET_COST });
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

/** Cancel matchmaking (e.g. player navigates away while waiting) — refunds the
 *  entry fee since no match (and thus no game) ever happened. */
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wasQueued = await isPlayerQueued(session.user.id);
  await leaveQueue(session.user.id);
  if (wasQueued) await addCurrency(session.user.id, { ticket: PVP_ENTRY_TICKET_COST });
  return NextResponse.json({ success: true });
}
