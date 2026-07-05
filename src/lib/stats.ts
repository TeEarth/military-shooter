import type { CharacterRow } from "./google/character";
import type { WeaponRow } from "./google/weapon";
import type { EquipmentStatTotals } from "./google/inventory";
import { getEquippedStatTotals } from "./google/inventory";
import { getPassiveTotals, type PassiveTotals } from "./google/passive";
import type { CombatLoadout } from "@/types/loadout";

/**
 * Central stat-merge formula, shared by /api/game/start (builds the loadout
 * Phaser actually plays with) and /api/player/stats (the Inventory page's
 * "base + bonus% = total" display) — both must compute identically or the
 * numbers shown before a match won't match what happens in it.
 *
 * Two distinct formulas, by design (confirmed against worked examples):
 *  - HP and damage are absolute base numbers boosted by a summed bonus %:
 *      final = base * (1 + totalBonusPercent / 100)
 *  - Accuracy, armor%, critChance%, and critDamage% are THEMSELVES already
 *    percentages, so every source (character/weapon's own value + equipment +
 *    passives) is summed directly — no multiplicative wrapper, and NOT capped
 *    at 100%. E.g. critDamage 300% + 120% from other sources = 420%, not 660%.
 */

export interface StatLine {
  base: number;
  bonusPercent: number;
  final: number;
}

export interface FullStatBreakdown {
  hp: StatLine;
  damage: StatLine;
  moveSpeed: StatLine;
  accuracy: StatLine;
  armorPercent: StatLine;
  critChance: StatLine;
  critDamage: StatLine;
  reloadTime: StatLine;
  fireRate: StatLine;
  dailyAmmo: StatLine;
  /** Flat total, not a StatLine — shield is a raw point sum from equipped gear, not a base+bonus% stat. */
  shieldMax: number;
}

function multiplicative(base: number, bonusPercent: number): StatLine {
  return { base, bonusPercent, final: base * (1 + bonusPercent / 100) };
}

/** For stats that are already percentages: every source is summed as a flat addend, uncapped. */
function additive(base: number, bonusPercent: number): StatLine {
  return { base, bonusPercent, final: base + bonusPercent };
}

export async function computeFullStats(playerId: string, character: CharacterRow, weapon: WeaponRow): Promise<FullStatBreakdown> {
  const [equipTotals, passives] = await Promise.all([
    getEquippedStatTotals(playerId),
    getPassiveTotals(playerId),
  ]);

  return buildStatBreakdown(character, weapon, equipTotals, passives);
}

export function buildStatBreakdown(
  character: CharacterRow,
  weapon: WeaponRow,
  equipTotals: EquipmentStatTotals,
  passives: PassiveTotals
): FullStatBreakdown {
  const hpBonusPercent = passives.hpPercent + equipTotals.hpPercent;
  const damageBonusPercent = passives.damagePercent + equipTotals.damagePercent;

  const accuracyBonus = character.accuracy + passives.accuracy; // equipment has no accuracy bonus in the current tables
  const armorBonus = 0; // equipment/passives have no armor% bonus in the current tables — character.armorPercent IS the base
  const critChanceBonus = character.critChance + equipTotals.critChancePercent + passives.critChance;
  const critDamageBonus = character.critDamage + equipTotals.critDamagePercent + passives.critDamagePercent;

  return {
    hp: multiplicative(character.hpMax, hpBonusPercent),
    damage: multiplicative(weapon.damage, damageBonusPercent),
    moveSpeed: { base: character.speed, bonusPercent: 0, final: character.speed },
    accuracy: additive(weapon.accuracy, accuracyBonus),
    armorPercent: additive(character.armorPercent, armorBonus),
    critChance: additive(weapon.critChance, critChanceBonus),
    critDamage: additive(weapon.critDamage, critDamageBonus),
    reloadTime: { base: weapon.reloadTime, bonusPercent: -passives.reloadSpeedPercent, final: Math.max(0.2, weapon.reloadTime * (1 - passives.reloadSpeedPercent / 100)) },
    fireRate: multiplicative(weapon.fireRate, passives.fireRatePercent),
    dailyAmmo: multiplicative(weapon.dailyAmmo, passives.dailyAmmoPercent),
    shieldMax: equipTotals.shieldValue,
  };
}

export function statsToLoadout(character: CharacterRow, weapon: WeaponRow, stats: FullStatBreakdown, remainingAmmo: number): CombatLoadout {
  return {
    id: character.id,
    name: `${character.name} + ${weapon.name}`,
    weaponId: weapon.id,
    sprite: character.sprite,
    bulletSprite: weapon.sprite,
    spreadDegrees: weapon.spreadDegrees,

    hpMax: Math.round(stats.hp.final),
    shieldMax: Math.round(stats.shieldMax),
    moveSpeed: stats.moveSpeed.final,
    armorPercent: stats.armorPercent.final,
    regenPer5s: character.regenPer5s,

    damage: Math.round(stats.damage.final),
    fireRate: stats.fireRate.final,
    fireMode: weapon.fireMode,
    projectileCount: weapon.projectileCount,
    accuracy: stats.accuracy.final,
    reloadTime: stats.reloadTime.final,
    magazineSize: weapon.magazineSize,
    criticalChance: stats.critChance.final,
    criticalDamage: stats.critDamage.final,
    explosionRadius: weapon.explosionRadius,

    ammo: remainingAmmo,
  };
}
