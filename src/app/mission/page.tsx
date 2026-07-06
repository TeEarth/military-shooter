import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllMissionsForPlayer, getPlayerMissionProgress } from "@/lib/db/mission";
import { getPlayerById } from "@/lib/db/player";
import { getCompletedStageIds } from "@/lib/db/stageProgress";
import { getPlayerIncome } from "@/lib/db/income";
import MissionClient from "@/components/mission/MissionClient";

export default async function MissionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [missions, progress, completedStageIds, income] = await Promise.all([
    getAllMissionsForPlayer(session.user.id, player.farmStageMaxWave),
    getPlayerMissionProgress(session.user.id),
    getCompletedStageIds(session.user.id),
    getPlayerIncome(player.id),
  ]);

  const missionsWithProgress = missions.map((m) => {
    const p = progress.find((pr) => pr.missionId === m.id);
    return { ...m, progress: p?.progress ?? 0, claimed: p?.claimed ?? false };
  });

  // Personal stage-clear milestones (every 5 story stages, forever) are auto-granted
  // in /api/game/complete, not claimed here — this is just informational progress.
  const milestone = {
    stagesCleared: completedStageIds.length,
    milestonesEarned: player.personalMilestoneTier,
    nextMilestoneAt: (Math.floor(completedStageIds.length / 5) + 1) * 5,
  };

  return (
    <MissionClient
      missions={missionsWithProgress}
      milestone={milestone}
      coin={player.coin}
      diamond={player.diamond}
      ticket={player.ticket}
      exp={player.exp}
      greenBanknote={income.greenBanknoteBalance}
    />
  );
}
