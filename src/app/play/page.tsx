import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllStages } from "@/lib/google/stage";
import { getPlayerById } from "@/lib/db/player";
import { getCompletedStageIds } from "@/lib/db/stageProgress";
import { getBossConfigForEncounter, getBossEncounterCount } from "@/lib/db/bossStage";
import StageSelectClient from "@/components/play/StageSelectClient";

export default async function PlayPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [stages, completedStageIds] = await Promise.all([
    getAllStages(),
    getCompletedStageIds(player.id),
  ]);

  // BossStage sheet may not exist yet on an un-migrated environment — degrade
  // gracefully to "no boss available" rather than breaking the whole page.
  let boss = { available: false, encounterNumber: 1, hp: 0 };
  // v17: each boss cleared (bossEncounterCount) unlocks the next multiverse —
  // multiverse 1 is always unlocked, so this starts at 1 with zero clears.
  let unlockedMultiverse = 1;
  try {
    const bossEncounterCount = await getBossEncounterCount(player.id);
    // v31 fix: locks encounter N to "has stage(N*10) actually been cleared"
    // instead of a generic stages-cleared/pacing formula — the old formula
    // could drift out of sync with which multiverse was actually just
    // finished (reported bug: Multiverse 2's boss fight still loading
    // Multiverse 1's map). See the matching fix in api/game/start/route.ts.
    const bossEncounterNumber = bossEncounterCount + 1;
    const requiredStageId = `stage${bossEncounterNumber * 10}`;
    const bossConfig = await getBossConfigForEncounter(bossEncounterNumber);
    boss = {
      available: completedStageIds.includes(requiredStageId),
      encounterNumber: bossEncounterNumber,
      hp: bossConfig.hp,
    };
    unlockedMultiverse = 1 + bossEncounterCount;
  } catch {
    // BossStage sheet not seeded yet — leave default (unavailable).
  }

  return (
    <StageSelectClient
      stages={stages}
      currentStage={player.currentStage}
      completedStageIds={completedStageIds}
      boss={boss}
      unlockedMultiverse={unlockedMultiverse}
      tutorialCompleted={player.tutorialCompleted}
    />
  );
}
