import type { IconName } from "@/components/ui/Icon";

/** v66: Daily Login Reward's 7-day repeating catalog — a small, fixed table
 *  in code (same pattern as src/lib/perks.ts), not sheet-driven, since the
 *  cycle length and reward types are unlikely to change on their own. Adding
 *  a new cycle/event later just means adding a new array here (or swapping
 *  this one out) — src/lib/db/dailyLogin.ts never hardcodes reward amounts,
 *  it always reads from this table. */
export interface DailyLoginRewardDef {
  day: number;
  icon: IconName;
  label: string;
  rewardDiamond?: number;
  rewardTicket?: number;
  /** Day 7 only — grants one free pull from DAILY_LOGIN_GACHA_POOL_ID instead
   *  of a flat currency amount. */
  isGachaPull?: boolean;
}

export const DAILY_LOGIN_CYCLE_LENGTH = 7;

export const DAILY_LOGIN_REWARDS: DailyLoginRewardDef[] = [
  { day: 1, icon: "diamond", label: "5 Diamond", rewardDiamond: 5 },
  { day: 2, icon: "ticket", label: "1 Ticket", rewardTicket: 1 },
  { day: 3, icon: "diamond", label: "5 Diamond", rewardDiamond: 5 },
  { day: 4, icon: "ticket", label: "1 Ticket", rewardTicket: 1 },
  { day: 5, icon: "diamond", label: "5 Diamond", rewardDiamond: 5 },
  { day: 6, icon: "ticket", label: "1 Ticket", rewardTicket: 1 },
  { day: 7, icon: "gacha", label: "Grand Gacha Pull", isGachaPull: true },
];

/** The gacha pool day 7's free pull rolls against — see src/lib/google/gacha.ts's pullGachaFree(). */
export const DAILY_LOGIN_GACHA_POOL_ID = "diamond_pool";
