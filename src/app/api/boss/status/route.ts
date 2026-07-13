import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompletedStageIds } from "@/lib/db/stageProgress";
import { getBossPacing, getBossConfigForEncounter, getBossEncounterCount } from "@/lib/db/bossStage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pacing, bossEncounterCount, completedStageIds] = await Promise.all([
    getBossPacing(),
    getBossEncounterCount(session.user.id),
    getCompletedStageIds(session.user.id),
  ]);

  const stagesCleared = completedStageIds.length;
  const tiersUnlocked = Math.floor(stagesCleared / pacing);
  const available = bossEncounterCount < tiersUnlocked;
  const encounterNumber = bossEncounterCount + 1;

  return NextResponse.json({
    success: true,
    data: {
      available,
      encounterNumber,
      hp: available ? (await getBossConfigForEncounter(encounterNumber)).hp : null,
      stagesCleared,
      nextUnlockAt: (bossEncounterCount + 1) * pacing,
    },
  });
}
