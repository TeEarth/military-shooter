import { getPlayerById, updatePlayer, addCurrency } from "./player";
import { pullGachaFree, type GachaPullResult } from "../google/gacha";
import { DAILY_LOGIN_REWARDS, DAILY_LOGIN_CYCLE_LENGTH, DAILY_LOGIN_GACHA_POOL_ID } from "../dailyLoginRewards";

/** Server time, UTC date-only — same lazy-reset pattern as Mission's
 *  todayUtc() (src/lib/db/mission.ts), dailyWithdrawnDate, dailyAdCoinDate. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface DailyLoginStatus {
  /** 1-7 — the day that will be granted on the next successful claim. Stays
   *  on today's already-claimed day (not the day after) while
   *  alreadyClaimedToday is true, so the UI can keep highlighting it. */
  nextClaimDay: number;
  alreadyClaimedToday: boolean;
  /** 0 if never claimed. */
  lastClaimedDay: number;
  /** v67: locked entirely until the player finishes the first-time Tutorial
   *  (Training Mode) — per request, a fresh account shouldn't see any Daily
   *  Login reward available until they've actually played the tutorial. */
  locked: boolean;
}

export async function getDailyLoginStatus(playerId: string): Promise<DailyLoginStatus> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const alreadyClaimedToday = player.dailyLoginDay > 0 && player.dailyLoginLastClaimDate === todayUtc();
  const nextClaimDay = alreadyClaimedToday ? player.dailyLoginDay : (player.dailyLoginDay % DAILY_LOGIN_CYCLE_LENGTH) + 1;

  return { nextClaimDay, alreadyClaimedToday, lastClaimedDay: player.dailyLoginDay, locked: !player.tutorialCompleted };
}

export interface DailyLoginClaimResult {
  day: number;
  rewardDiamond: number;
  rewardTicket: number;
  gachaResult?: GachaPullResult;
}

/** Grants the next day's reward and advances the cycle. Per spec: missing a
 *  day never resets progress — the player just gets the next day in
 *  sequence whenever they come back, and the cycle wraps 7 -> 1
 *  automatically. Throws if today's reward was already claimed. */
export async function claimDailyLogin(playerId: string): Promise<DailyLoginClaimResult> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");
  if (!player.tutorialCompleted) throw new Error("Finish the Tutorial (Training Mode) first to unlock Daily Login rewards.");

  const today = todayUtc();
  if (player.dailyLoginDay > 0 && player.dailyLoginLastClaimDate === today) {
    throw new Error("Already claimed today");
  }

  const nextDay = (player.dailyLoginDay % DAILY_LOGIN_CYCLE_LENGTH) + 1;
  const def = DAILY_LOGIN_REWARDS.find((r) => r.day === nextDay);
  if (!def) throw new Error(`Daily login reward not configured for day ${nextDay}`);

  let gachaResult: GachaPullResult | undefined;
  if (def.isGachaPull) {
    gachaResult = await pullGachaFree(playerId, DAILY_LOGIN_GACHA_POOL_ID);
  } else if (def.rewardDiamond || def.rewardTicket) {
    await addCurrency(playerId, { diamond: def.rewardDiamond ?? 0, ticket: def.rewardTicket ?? 0 });
  }

  await updatePlayer(playerId, { dailyLoginDay: nextDay, dailyLoginLastClaimDate: today });

  return { day: nextDay, rewardDiamond: def.rewardDiamond ?? 0, rewardTicket: def.rewardTicket ?? 0, gachaResult };
}
