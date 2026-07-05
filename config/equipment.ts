import type { Rarity } from "@/lib/google/inventory";

/**
 * Bonus granted per dupe-upgrade level, by rarity — fixed game design rule
 * (not meant to be rebalanced as often as weapon/character numbers), so it
 * lives here rather than in a sheet. Base rarity bonuses are still fully
 * sheet-driven (Equipment sheet) since those ARE meant to be tuned often.
 */
export const DUPE_UPGRADE_BONUS: Record<Rarity, { hpPercent: number; damagePercent: number; critChancePercent: number; critDamagePercent: number }> = {
  common: { hpPercent: 1, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0 },
  rare: { hpPercent: 1, damagePercent: 1, critChancePercent: 0, critDamagePercent: 0 },
  epic: { hpPercent: 1, damagePercent: 1, critChancePercent: 0, critDamagePercent: 1 },
  legendary: { hpPercent: 1, damagePercent: 1, critChancePercent: 1, critDamagePercent: 1 },
};
