import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency } from "@/lib/db/player";

const REVIVE_TICKET_COST = 30;

/** Spends 30 tickets to revive the player mid-run — the client enforces "once
 *  per game" (see GameScene's reviveUsedThisGame flag), this route only
 *  enforces the actual currency spend server-side. */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (player.ticket < REVIVE_TICKET_COST) {
    return NextResponse.json({ error: `Not enough tickets (need ${REVIVE_TICKET_COST})` }, { status: 400 });
  }

  const updated = await addCurrency(player.id, { ticket: -REVIVE_TICKET_COST });
  return NextResponse.json({ success: true, ticket: updated.ticket });
}
