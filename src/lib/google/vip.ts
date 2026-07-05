import { getCachedSheet } from "./cache";

const SHEET = "VipConfig";

export interface VipConfigRow {
  /** The VIP level this row unlocks (1-10). */
  level: number;
  /** Incremental exp needed from (level-1) to reach this level — NOT cumulative. */
  expRequired: number;
}

function rowToVipConfig(row: Record<string, string>): VipConfigRow {
  return {
    level: Number(row.level || 0),
    expRequired: Number(row.expRequired || 0),
  };
}

export async function getVipConfig(): Promise<VipConfigRow[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToVipConfig).sort((a, b) => a.level - b.level);
}

export interface VipProgress {
  level: number;
  /** How much of vipExp has been "spent" progressing within the current level. */
  expIntoCurrentLevel: number;
  /** Exp needed to reach the next level, or null if already at max (level 10). */
  expRequiredForNextLevel: number | null;
  isMaxLevel: boolean;
}

/**
 * VIP is earned purely from cumulative `vipExp` (fed only by story/farm stage
 * clear rewardExp, see /api/game/complete) — never decreases, so level is
 * always recomputed as "how far does this total reach down the table",
 * rather than debiting a spendable pool. Matches the v9 spec's cumulative-
 * threshold option exactly.
 */
export async function computeVipProgress(vipExp: number): Promise<VipProgress> {
  const config = await getVipConfig();
  let cumulative = 0;
  let level = 0;

  for (const row of config) {
    const threshold = cumulative + row.expRequired;
    if (vipExp >= threshold) {
      level = row.level;
      cumulative = threshold;
    } else {
      break;
    }
  }

  const nextRow = config.find((r) => r.level === level + 1);
  return {
    level,
    expIntoCurrentLevel: vipExp - cumulative,
    expRequiredForNextLevel: nextRow?.expRequired ?? null,
    isMaxLevel: !nextRow,
  };
}
