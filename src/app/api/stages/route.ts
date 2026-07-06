import { NextResponse } from "next/server";
import { getAllStages } from "@/lib/google/stage";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/db/player";

function stageNumber(stageId: string): number {
  return Number(stageId.replace(/\D/g, "")) || 0;
}

export async function GET() {
  const [session, stages] = await Promise.all([auth(), getAllStages()]);

  let currentStage = 1;
  if (session?.user?.id) {
    const player = await getPlayerById(session.user.id);
    if (player) currentStage = player.currentStage;
  }

  const stagesWithProgress = stages.map((s) => ({
    ...s,
    // Repeatable farm stages are always unlocked — no story-progress gate.
    unlocked: s.isRepeatable || stageNumber(s.id) <= currentStage,
  }));

  return NextResponse.json({ success: true, data: stagesWithProgress });
}
