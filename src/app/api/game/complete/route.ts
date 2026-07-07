import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, recordFarmWave, updatePlayer } from "@/lib/db/player";
import { getStageById } from "@/lib/google/stage";
import { getCompletedStageIds, markStageCompleted } from "@/lib/db/stageProgress";
import { deductWeaponAmmo } from "@/lib/db/weaponAmmo";
import { incrementMissionProgress, setMissionProgressIfHigher } from "@/lib/db/mission";
import { parseStageNumber, templateStageId } from "@/lib/stageTemplate";
import { incrementBossEncounterCount } from "@/lib/db/bossStage";
import { addGreenBanknotes } from "@/lib/db/income";
import { recordWeeklyFarmWave } from "@/lib/db/leaderboard";

const MILESTONE_INTERVAL = 5;
const MILESTONE_DIAMOND_REWARD = 10;
const MILESTONE_BATCH_SIZE = 5; // every 5 milestones -> green banknotes
const MILESTONE_BATCH_BANKNOTES = 5;
const VIP10_GREEN_BANKNOTE_REWARD = 100;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stageId, weaponId, completed, kills, killCoin: rawKillCoin, farmWaveReached, ammoUsed } = await req.json();

  // Real currency earned from kills this run (per-enemy-type coinReward, summed
  // client-side in GameScene as each enemy dies) — previously this was computed
  // client-side ONLY for the cosmetic "score" HUD number and never actually sent
  // to the backend at all, so killing enemies never affected the player's real
  // coin balance. Granted regardless of win/loss — you keep money from enemies
  // you actually killed even if you die before clearing the stage.
  const killCoin = typeof rawKillCoin === "number" && rawKillCoin > 0 ? Math.round(rawKillCoin) : 0;

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const tasks: Promise<unknown>[] = [];
  if (weaponId && ammoUsed > 0) tasks.push(deductWeaponAmmo(player.id, weaponId, ammoUsed));

  // v9 #3: kill-count mission progress is purely cosmetic bookkeeping — it
  // doesn't affect this response's rewards or gate anything the client does
  // next, so it doesn't need to block the response. after() (not a bare
  // fire-and-forget) is what makes this safe on Vercel specifically: a plain
  // un-awaited promise can get killed the instant the serverless function
  // returns, silently dropping the write; after() is guaranteed to run to
  // completion before the function's execution context is torn down.
  if (typeof kills === "number" && kills > 0) {
    after(() => incrementMissionProgress(player.id, "kills", kills).catch(() => {}));
  }

  if (typeof stageId === "string" && stageId.startsWith("boss_")) {
    // v17: flat victory package on top of whatever coin was earned from
    // killing the boss/its summoned minions along the way — killCoin and the
    // fixed reward are additive, not either/or.
    const BOSS_VICTORY_COIN = 500;
    const BOSS_VICTORY_DIAMOND = 50;
    const BOSS_VICTORY_TICKET = 10;
    const BOSS_VICTORY_BANKNOTE = 1;

    const coin = killCoin + (completed ? BOSS_VICTORY_COIN : 0);
    const rewards: { coin?: number; diamond?: number; ticket?: number; greenBanknote?: number } = {};

    if (coin > 0) {
      rewards.coin = coin;
      tasks.push(addCurrency(player.id, { coin }));
    }
    if (completed) {
      rewards.diamond = BOSS_VICTORY_DIAMOND;
      rewards.ticket = BOSS_VICTORY_TICKET;
      rewards.greenBanknote = BOSS_VICTORY_BANKNOTE;
      tasks.push(addCurrency(player.id, { diamond: BOSS_VICTORY_DIAMOND, ticket: BOSS_VICTORY_TICKET }));
      tasks.push(incrementBossEncounterCount(player.id));
      tasks.push(addGreenBanknotes(player.id, BOSS_VICTORY_BANKNOTE));
    }
    await Promise.all(tasks);
    return NextResponse.json({ success: true, rewards });
  }

  // v17: same "prefer an exact purpose-built Stage row over the modulo-10
  // template reuse" resolution as start/route.ts — must stay consistent so
  // this route rewards/completes the SAME stage the run was actually played on.
  const requestedNum = parseStageNumber(stageId);
  let lookupId = stageId;
  if (requestedNum) {
    const exact = await getStageById(stageId);
    lookupId = exact ? stageId : templateStageId(requestedNum);
  }
  const stage = await getStageById(lookupId);
  if (!stage) return NextResponse.json({ error: "Stage not found" }, { status: 404 });

  let rewards: { coin: number; exp: number; milestoneDiamond?: number; greenBanknote?: number; vipLevel?: number } | null = null;
  // v9 #2: VIP exp is fed ONLY by Stage.rewardExp (story or farm clears) — not
  // character exp/level, not kills, not milestone/passive bonuses.
  // v16: addCurrency() itself now writes vipExp/vipLevel whenever `exp` is
  // passed (see db/player.ts) — this flag just remembers whether THIS
  // request granted any, so we know whether to re-check for a level-up below.
  let grantedExp = false;

  if (stage.isRepeatable) {
    const clearedWave = typeof farmWaveReached === "number" && farmWaveReached > 0;
    if (clearedWave) {
      tasks.push(recordFarmWave(player.id, farmWaveReached));
      // v16: leaderboard's own weekly-reset counter, separate from the permanent record above.
      tasks.push(recordWeeklyFarmWave(player.id, farmWaveReached));
      // v10 #2: farm-wave milestone missions are a high-water mark, not additive —
      // this is the personal-best wave reached THIS run, not a delta to sum.
      after(() => setMissionProgressIfHigher(player.id, "farm_wave", farmWaveReached).catch(() => {}));
    }

    // v15: farm stage coin comes ONLY from killing enemies (killCoin) — no
    // separate wave-clear coin bonus anymore, per explicit request.
    // Exp uses a fixed formula independent of the sheet's rewardExp: clearing
    // wave N alone is worth (N+1) exp, and since only the final highest wave
    // reached this run is reported (not each wave as it's cleared), the total
    // awarded is the sum of every wave's marginal reward up through N:
    // sum_{i=1}^{N} (i+1) = N*(N+3)/2 — e.g. N=1 -> 2, N=2 -> 2+3=5, N=3 -> 2+3+4=9.
    const coin = killCoin;
    const exp = clearedWave ? (farmWaveReached * (farmWaveReached + 3)) / 2 : 0;
    grantedExp = exp > 0;
    if (coin > 0 || exp > 0) {
      rewards = { coin, exp };
      tasks.push(addCurrency(player.id, { coin, exp }));
    }
  } else {
    const coin = (completed ? stage.rewardCoin : 0) + killCoin;
    const exp = completed ? stage.rewardExp : 0;
    grantedExp = exp > 0;
    if (coin > 0 || exp > 0) {
      rewards = { coin, exp };
      tasks.push(addCurrency(player.id, { coin, exp }));
    }

    if (completed) {
      tasks.push(markStageCompleted(player.id, stageId)); // critical: gates replay, must be awaited
      after(() => incrementMissionProgress(player.id, "stage_complete", 1).catch(() => {})); // cosmetic progress only
      // v10 #2: "reach stage 5"/"reach stage 10" missions are a high-water mark
      // on the story stage number just cleared, not additive.
      if (requestedNum) {
        after(() => setMissionProgressIfHigher(player.id, "stage_reached", requestedNum).catch(() => {}));
      }

      // Advance story progression so the "next" stage number becomes playable.
      if (requestedNum && requestedNum >= player.currentStage) {
        tasks.push(updatePlayer(player.id, { currentStage: requestedNum + 1 }));
      }
    }
  }

  await Promise.all(tasks);

  // v16: addCurrency() already wrote the new vipExp/vipLevel (it was one of
  // `tasks` above) — just re-read the player to see whether that pushed them
  // to a new VIP level, instead of recomputing it a second time here.
  if (grantedExp) {
    const updated = await getPlayerById(player.id);
    const oldLevel = player.vipLevel;

    if (updated && updated.vipLevel !== oldLevel) {
      rewards = { ...(rewards ?? { coin: 0, exp: 0 }), vipLevel: updated.vipLevel };
    }

    // v9 #2: one-time VIP10 reward — 100 green banknotes, only the first time
    // the account crosses the threshold (oldLevel < 10 guards against re-granting
    // on every subsequent stage clear once already at VIP10).
    if (updated && oldLevel < 10 && updated.vipLevel >= 10) {
      await addGreenBanknotes(player.id, VIP10_GREEN_BANKNOTE_REWARD);
      rewards = { ...(rewards ?? { coin: 0, exp: 0 }), greenBanknote: (rewards?.greenBanknote ?? 0) + VIP10_GREEN_BANKNOTE_REWARD };
    }
  }

  if (!stage.isRepeatable && completed) {
    // Personal stage-clear milestones (5, 10, 15, ... forever) — auto-granted,
    // no claim button, generated by formula rather than stored as sheet rows.
    const stagesCleared = (await getCompletedStageIds(player.id)).length;
    const milestonesEarned = Math.floor(stagesCleared / MILESTONE_INTERVAL);
    const newMilestones = milestonesEarned - player.personalMilestoneTier;

    if (newMilestones > 0) {
      const milestoneDiamond = newMilestones * MILESTONE_DIAMOND_REWARD;
      await addCurrency(player.id, { diamond: milestoneDiamond });
      await updatePlayer(player.id, { personalMilestoneTier: milestonesEarned });
      rewards = { ...(rewards ?? { coin: 0, exp: 0 }), milestoneDiamond };

      const greenTierEarned = Math.floor(milestonesEarned / MILESTONE_BATCH_SIZE);
      const newGreenTiers = greenTierEarned - player.personalMilestoneGreenTier;
      if (newGreenTiers > 0) {
        const greenBanknote = newGreenTiers * MILESTONE_BATCH_BANKNOTES;
        await addGreenBanknotes(player.id, greenBanknote);
        await updatePlayer(player.id, { personalMilestoneGreenTier: greenTierEarned });
        rewards = { ...rewards, greenBanknote };
      }
    }
  }

  return NextResponse.json({ success: true, rewards });
}
