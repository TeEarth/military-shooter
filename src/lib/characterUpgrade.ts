/** Permanent, per-character, uncapped HP upgrade — data-driven (formula, not
 *  hardcoded per-level values) so the balance can be tuned in one place.
 *  Independent of the Passive Upgrade system (src/lib/perks.ts's neighbor,
 *  a separate global % boost) — this only ever touches ONE character's own
 *  base HP, stored per character id (see Player.characterUpgradeLevels). */

/** +10% of the ORIGINAL base HP per level — deliberately linear off the
 *  original base, not compounding off the already-upgraded value, so 10
 *  levels is always exactly +100%, never more. */
const HP_BONUS_PER_LEVEL = 0.1;

/** Cost of the upgrade that takes a character FROM `currentLevel` to
 *  `currentLevel + 1` — 50 coin at level 0, doubling every level. */
const BASE_UPGRADE_COST = 50;

export function getUpgradedBaseHp(originalBaseHp: number, upgradeLevel: number): number {
  return Math.round(originalBaseHp * (1 + HP_BONUS_PER_LEVEL * upgradeLevel));
}

export function getUpgradeCost(currentLevel: number): number {
  return BASE_UPGRADE_COST * Math.pow(2, currentLevel);
}
