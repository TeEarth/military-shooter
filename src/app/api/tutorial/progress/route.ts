import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, updatePlayer } from "@/lib/db/player";

const VALID_STEPS = new Set(["MOVE", "SHOOT", "RELOAD", "KILL_ENEMY", "STEALTH", "FREE_COMBAT"]);

/** Checkpoints the tutorial's current state so quitting mid-run resumes at
 *  the same step instead of restarting from MOVE (see TutorialScene.ts). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { step } = (await req.json()) as { step: string };
  if (!VALID_STEPS.has(step)) return NextResponse.json({ error: "Unknown tutorial step" }, { status: 400 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (player.tutorialCompleted) return NextResponse.json({ success: true }); // no-op once already done

  await updatePlayer(player.id, { tutorialStep: step });
  return NextResponse.json({ success: true });
}
