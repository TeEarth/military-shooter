import { getConfigRows } from "../db/configCache";
import { parseBool } from "./sheet";

const STAGE_SHEET = "Stage";
const STAGE_ENEMY_SHEET = "StageEnemy";
const STAGE_COVER_SHEET = "StageCover";

export interface StageRow {
  id: string;
  name: string;
  background: string;
  width: number;
  height: number;
  rewardCoin: number;
  rewardExp: number;
  isRepeatable: boolean;
  /** v11: real player spawn point from the stage-layout PDF — 0 means "not
   *  designed yet", so GameScene falls back to its old hardcoded default. */
  playerSpawnX: number;
  playerSpawnY: number;
  /** v17: which "multiverse" (world) this stage belongs to — 1 for the
   *  original 10 story stages, 2+ unlocked one at a time by clearing that
   *  multiverse's boss. Existing rows default to 1 (blank cell). */
  multiverse: number;
  /** v17: placeholder stage seeded ahead of its real content being designed —
   *  shown in the stage list (so the multiverse feels populated once
   *  unlocked) but not clickable/playable yet. */
  comingSoon: boolean;
}

export interface StageEnemySpawn {
  stageId: string;
  enemyId: string;
  spawnX: number;
  spawnY: number;
}

/** v11: a single cover object placed at a real, designed position (from the
 *  stage-layout PDF) instead of GameScene's random scatter. */
export interface StageCoverSpawn {
  stageId: string;
  coverType: string;
  x: number;
  y: number;
}

function rowToStage(row: Record<string, string>): StageRow {
  return {
    id: row.id,
    name: row.name,
    background: row.background || "/assets/sprites/background/battlefield_ground.svg",
    width: Number(row.width || 1280),
    height: Number(row.height || 720),
    rewardCoin: Number(row.rewardCoin || 100),
    rewardExp: Number(row.rewardExp || 150),
    isRepeatable: parseBool(row.isRepeatable),
    playerSpawnX: Number(row.playerSpawnX || 0),
    playerSpawnY: Number(row.playerSpawnY || 0),
    // v17: fail safe to 1 (not NaN) for a blank OR garbage cell — a stray
    // non-numeric value here previously produced a broken "Multiverse NaN"
    // tab in the UI instead of just defaulting sanely.
    multiverse: (() => {
      const n = Number(row.multiverse);
      return Number.isFinite(n) && n > 0 ? n : 1;
    })(),
    comingSoon: parseBool(row.comingSoon),
  };
}

export async function getAllStages(): Promise<StageRow[]> {
  const rows = await getConfigRows(STAGE_SHEET);
  return rows.map(rowToStage).sort((a, b) => {
    if (a.isRepeatable !== b.isRepeatable) return a.isRepeatable ? 1 : -1;
    return Number(a.id.replace(/\D/g, "")) - Number(b.id.replace(/\D/g, ""));
  });
}

export async function getStageById(id: string): Promise<StageRow | null> {
  const stages = await getAllStages();
  return stages.find((s) => s.id === id) ?? null;
}

export async function getStageEnemies(stageId: string): Promise<StageEnemySpawn[]> {
  const rows = await getConfigRows(STAGE_ENEMY_SHEET);
  return rows
    .filter((r) => r.stageId === stageId)
    .map((r) => ({ stageId: r.stageId, enemyId: r.enemyId, spawnX: Number(r.spawnX || 0), spawnY: Number(r.spawnY || 0) }));
}

/** v11: real cover layout for stages designed from the stage-layout PDF —
 *  empty for any stage that hasn't been designed yet, letting GameScene fall
 *  back to its random scatter for those. */
export async function getStageCovers(stageId: string): Promise<StageCoverSpawn[]> {
  const rows = await getConfigRows(STAGE_COVER_SHEET);
  return rows
    .filter((r) => r.stageId === stageId)
    .map((r) => ({ stageId: r.stageId, coverType: r.coverType, x: Number(r.x || 0), y: Number(r.y || 0) }));
}
