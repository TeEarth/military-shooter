import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";

const TUTORIAL_TICKET_REWARD = 10;

/** One-time reward for finishing the tutorial — idempotent per account
 *  (tutorialCompleted guards against re-granting on a duplicate/retried call). */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (player.tutorialCompleted) return NextResponse.json({ success: true, alreadyCompleted: true });

  await updatePlayer(player.id, { tutorialCompleted: true, tutorialStep: "FREE_COMBAT" });
  const updatedPlayer = await addCurrency(player.id, { ticket: TUTORIAL_TICKET_REWARD });

  return NextResponse.json({ success: true, ticketReward: TUTORIAL_TICKET_REWARD, updatedPlayer: toPublicPlayer(updatedPlayer) });
}
