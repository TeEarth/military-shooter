import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCompletedStageIds } from "@/lib/db/stageProgress";
import { getBossConfigForEncounter, getBossEncounterCount } from "@/lib/db/bossStage";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [bossEncounterCount, completedStageIds] = await Promise.all([
    getBossEncounterCount(session.user.id),
    getCompletedStageIds(session.user.id),
  ]);

  // v31 fix: locks encounter N to "has stage(N*10) actually been cleared"
  // instead of a generic stages-cleared/pacing formula that could drift out
  // of sync with which multiverse was actually just finished — same fix as
  // api/game/start/route.ts and app/play/page.tsx.
  const encounterNumber = bossEncounterCount + 1;
  const requiredStageId = `stage${encounterNumber * 10}`;
  const available = completedStageIds.includes(requiredStageId);

  return NextResponse.json({
    success: true,
    data: {
      available,
      encounterNumber,
      hp: available ? (await getBossConfigForEncounter(encounterNumber)).hp : null,
      stagesCleared: completedStageIds.length,
      nextUnlockAt: requiredStageId,
    },
  });
}
