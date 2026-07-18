import { ENEMY_CONFIG } from "../../config/enemy";

/**
 * Story stages loop every 10 numbers: stage 11 reuses stage 1's map/spawns
 * (just harder), stage 21 reuses stage 1 again, etc. This does NOT affect the
 * "clear once, never replay" rule (that's tracked per exact stage number in
 * PlayerStageProgress) — it only controls which map layout/spawns to draw
 * from for a given stage number.
 */
/** Only matches numbered story-stage ids ("stage1", "stage11", ...) — never farm/boss ids
 *  like "farm_01" or "boss_3", which must NOT be reinterpreted as a story stage number. */
export function parseStageNumber(stageId: string): number | null {
  const match = /^stage(\d+)$/i.exec(stageId);
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

/** Which of the (up to 10) template maps a given story stage number reuses. */
export function templateStageId(stageNumber: number): string {
  const templateNum = ((stageNumber - 1) % 10) + 1;
  return `stage${String(templateNum).padStart(2, "0")}`;
}

/** 0 for stages 1-10, 1 for 11-20, 2 for 21-30, ... — drives compounding difficulty. */
export function difficultyTier(stageNumber: number): number {
  return Math.floor((stageNumber - 1) / 10);
}

/** Compounding +10%/tier multiplier applied to enemy HP and damage. */
export function stageStatMultiplier(stageNumber: number): number {
  const tier = difficultyTier(stageNumber);
  return Math.pow(1 + ENEMY_CONFIG.difficultyScaling.statMultiplierPerTier, tier);
}

/** Stages 1-3 felt too hard for brand-new accounts (per user feedback) — half
 *  enemy HP and damage there specifically, on top of the normal tier
 *  multiplier above (which is 1.0 for the whole first 10 stages anyway, so
 *  this is the only difficulty adjustment stages 1-3 get). Every other stage
 *  is untouched. */
export function earlyStageDifficultyMultiplier(stageNumber: number): number {
  return stageNumber <= 3 ? 0.5 : 1;
}

/** Extra enemies to add on top of the template's normal spawn list. */
export function extraEnemyCount(stageNumber: number): number {
  return difficultyTier(stageNumber) * ENEMY_CONFIG.difficultyScaling.extraEnemiesPerTier;
}
