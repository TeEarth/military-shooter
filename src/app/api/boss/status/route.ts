import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompletedStageIds } from "@/lib/google/stageProgress";
import { getBossStageConfig, getBossEncounterCount, scaledBossHp } from "@/lib/google/bossStage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [config, bossEncounterCount, completedStageIds] = await Promise.all([
    getBossStageConfig(),
    getBossEncounterCount(session.user.id),
    getCompletedStageIds(session.user.id),
  ]);

  const stagesCleared = completedStageIds.length;
  const tiersUnlocked = Math.floor(stagesCleared / config.occursEveryNStages);
  const available = bossEncounterCount < tiersUnlocked;
  const encounterNumber = bossEncounterCount + 1;

  return NextResponse.json({
    success: true,
    data: {
      available,
      encounterNumber,
      hp: available ? scaledBossHp(config, encounterNumber) : null,
      stagesCleared,
      nextUnlockAt: (bossEncounterCount + 1) * config.occursEveryNStages,
    },
  });
}
