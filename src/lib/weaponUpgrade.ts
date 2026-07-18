/** Permanent, per-weapon, uncapped damage upgrade — data-driven (formula, not
 *  hardcoded per-level values), same shape as src/lib/characterUpgrade.ts but
 *  its own cost curve (tripling instead of doubling) and its own DB field
 *  (weaponUpgradeLevels), entirely independent of the character upgrade
 *  system. Central "single source of truth" for weapon damage, mirrored the
 *  same way computeFullStats() already is the single source for HP. */

/** +10% of the ORIGINAL base damage per level — linear off the original base,
 *  never compounding off the already-upgraded value. */
const DAMAGE_BONUS_PER_LEVEL = 0.1;

/** Cost of the upgrade that takes a weapon FROM `currentLevel` to
 *  `currentLevel + 1` — 50 coin at level 0, TRIPLING every level
 *  (50, 150, 450, 1350, 4050, ...). */
const BASE_UPGRADE_COST = 50;
const COST_MULTIPLIER = 3;

export function getUpgradedBaseDamage(originalBaseDamage: number, upgradeLevel: number): number {
  return Math.round(originalBaseDamage * (1 + DAMAGE_BONUS_PER_LEVEL * upgradeLevel));
}

export function getWeaponUpgradeCost(currentLevel: number): number {
  return BASE_UPGRADE_COST * Math.pow(COST_MULTIPLIER, currentLevel);
}
