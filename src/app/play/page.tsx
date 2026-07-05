import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllStages } from "@/lib/google/stage";
import { getPlayerById } from "@/lib/google/player";
import { getCompletedStageIds } from "@/lib/google/stageProgress";
import { getBossStageConfig, getBossEncounterCount, scaledBossHp } from "@/lib/google/bossStage";
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
  try {
    const [bossConfig, bossEncounterCount] = await Promise.all([
      getBossStageConfig(),
      getBossEncounterCount(player.id),
    ]);
    const tiersUnlocked = Math.floor(completedStageIds.length / bossConfig.occursEveryNStages);
    const bossEncounterNumber = bossEncounterCount + 1;
    boss = {
      available: bossEncounterCount < tiersUnlocked,
      encounterNumber: bossEncounterNumber,
      hp: scaledBossHp(bossConfig, bossEncounterNumber),
    };
  } catch {
    // BossStage sheet not seeded yet — leave default (unavailable).
  }

  return (
    <StageSelectClient
      stages={stages}
      currentStage={player.currentStage}
      completedStageIds={completedStageIds}
      boss={boss}
    />
  );
}
