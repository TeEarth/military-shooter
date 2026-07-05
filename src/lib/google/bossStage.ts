import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, updateRow } from "./sheet";

const BOSS_STAGE_SHEET = "BossStage";
const PLAYER_BOSS_PROGRESS_SHEET = "PlayerBossProgress";

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
  const { rows } = await getCachedSheet(BOSS_STAGE_SHEET);
  if (rows.length === 0) throw new Error("BossStage config not seeded");
  return rowToBossStage(rows[0]);
}

export async function getBossEncounterCount(playerId: string): Promise<number> {
  const found = await findRow(PLAYER_BOSS_PROGRESS_SHEET, (r) => r.playerId === playerId);
  return found ? Number(found.row.bossEncounterCount || 0) : 0;
}

/** Boss HP compounds +growthPercent% per encounter, same pattern as story-stage tier scaling. */
export function scaledBossHp(config: BossStageRow, encounterNumber: number): number {
  return Math.round(config.hp * Math.pow(1 + config.growthPercent / 100, encounterNumber - 1));
}

export async function incrementBossEncounterCount(playerId: string): Promise<number> {
  const found = await findRow(PLAYER_BOSS_PROGRESS_SHEET, (r) => r.playerId === playerId);
  const next = found ? Number(found.row.bossEncounterCount || 0) + 1 : 1;
  if (found) {
    await updateRow(PLAYER_BOSS_PROGRESS_SHEET, found.rowIndex, { bossEncounterCount: next });
  } else {
    await appendRow(PLAYER_BOSS_PROGRESS_SHEET, { playerId, bossEncounterCount: next });
  }
  invalidateSheetCache(PLAYER_BOSS_PROGRESS_SHEET);
  return next;
}
