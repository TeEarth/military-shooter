import { getConfigRows } from "../db/configCache";

const BOSS_STAGE_SHEET = "BossStage";

// v16: this file used to also contain PlayerBossProgress read/write functions
// backed directly by Google Sheets — those were fully superseded by the
// Supabase-backed versions in src/lib/db/bossStage.ts during the v12
// migration and had been dead code (zero imports) ever since. Removed as
// part of the v16 cleanup; this file now only holds the BossStage config
// catalog (a single scaling-formula row), still legitimately read from
// Sheets/the config cache.

export interface BossStageRow {
  bossId: string;
  hp: number;
  weaponId: string;
  rocketCount: number;
  growthPercent: number;
  occursEveryNStages: number;
}

function rowToBossStage(row: Record<string, string>): BossStageRow {
  return {
    bossId: row.bossId,
    hp: Number(row.hp || 2000),
    weaponId: row.weaponId || "rocket_launcher",
    rocketCount: Number(row.rocketCount || 5),
    growthPercent: Number(row.growthPercent || 10),
    occursEveryNStages: Number(row.occursEveryNStages || 10),
  };
}

/** Only one boss config row is seeded for now — all boss encounters use it, scaled by encounter number. */
export async function getBossStageConfig(): Promise<BossStageRow> {
  const rows = await getConfigRows(BOSS_STAGE_SHEET);
  if (rows.length === 0) throw new Error("BossStage config not seeded");
  return rowToBossStage(rows[0]);
}

/** Boss HP compounds +growthPercent% per encounter, same pattern as story-stage tier scaling. */
export function scaledBossHp(config: BossStageRow, encounterNumber: number): number {
  return Math.round(config.hp * Math.pow(1 + config.growthPercent / 100, encounterNumber - 1));
}
