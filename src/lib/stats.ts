import type { CharacterRow } from "./google/character";
import type { WeaponRow } from "./google/weapon";
import type { EquipmentStatTotals } from "./db/inventory";
import { getEquippedStatTotals } from "./db/inventory";
import { getPassiveTotals, type PassiveTotals } from "./db/passive";
import { getPlayerById } from "./db/player";
import { getUpgradedBaseHp } from "./characterUpgrade";
import { getUpgradedBaseDamage } from "./weaponUpgrade";
import type { CombatLoadout } from "@/types/loadout";
import { characterSkinSpritePath } from "./characterSkins";

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
  /** Combined bonus % (equipment + passive) — kept for the final-value formula. */
  bonusPercent: number;
  /** v13: equipment and passive bonuses shown SEPARATELY in the UI, not just
   *  merged — so a player can see "gear gives +12%, passives give +8%"
   *  instead of one opaque "+20%". Always 0 for stats equipment/passives
   *  don't contribute to (e.g. moveSpeed). */
  equipmentBonusPercent: number;
  passiveBonusPercent: number;
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

function multiplicative(base: number, equipmentBonusPercent: number, passiveBonusPercent: number): StatLine {
  const bonusPercent = equipmentBonusPercent + passiveBonusPercent;
  return { base, bonusPercent, equipmentBonusPercent, passiveBonusPercent, final: base * (1 + bonusPercent / 100) };
}

/** For stats that are already percentages: every source is summed as a flat addend, uncapped. */
function additive(base: number, equipmentBonusPercent: number, passiveBonusPercent: number): StatLine {
  const bonusPercent = equipmentBonusPercent + passiveBonusPercent;
  return { base, bonusPercent, equipmentBonusPercent, passiveBonusPercent, final: base + bonusPercent };
}

export async function computeFullStats(playerId: string, character: CharacterRow, weapon: WeaponRow): Promise<FullStatBreakdown> {
  const [equipTotals, passives, player] = await Promise.all([
    getEquippedStatTotals(playerId),
    getPassiveTotals(playerId),
    getPlayerById(playerId),
  ]);
  const characterUpgradeLevel = player?.characterUpgradeLevels[character.id] ?? 0;
  const weaponUpgradeLevel = player?.weaponUpgradeLevels[weapon.id] ?? 0;

  return buildStatBreakdown(character, weapon, equipTotals, passives, characterUpgradeLevel, weaponUpgradeLevel);
}

export function buildStatBreakdown(
  character: CharacterRow,
  weapon: WeaponRow,
  equipTotals: EquipmentStatTotals,
  passives: PassiveTotals,
  /** v46: this character's OWN permanent HP upgrade level (see
   *  src/lib/characterUpgrade.ts) — 0 if never upgraded. Applied to base HP
   *  BEFORE the equipment/passive %, so it's the single source of truth every
   *  mode (PvE/PvP/Tutorial) and every display (Home/Character/Result) reads
   *  from equally. */
  characterUpgradeLevel = 0,
  /** v47: this WEAPON's own permanent damage upgrade level (see
   *  src/lib/weaponUpgrade.ts) — 0 if never upgraded. Same "applied before
   *  equipment/passive %, single source of truth everywhere" treatment as HP. */
  weaponUpgradeLevel = 0
): FullStatBreakdown {
  const upgradedBaseHp = getUpgradedBaseHp(character.hpMax, characterUpgradeLevel);
  const upgradedBaseDamage = getUpgradedBaseDamage(weapon.damage, weaponUpgradeLevel);
  return {
    hp: multiplicative(upgradedBaseHp, equipTotals.hpPercent, passives.hpPercent),
    damage: multiplicative(upgradedBaseDamage, equipTotals.damagePercent, passives.damagePercent),
    moveSpeed: { base: character.speed, bonusPercent: 0, equipmentBonusPercent: 0, passiveBonusPercent: 0, final: character.speed },
    // equipment has no accuracy bonus in the current tables
    accuracy: additive(weapon.accuracy + character.accuracy, 0, passives.accuracy),
    // equipment/passives have no armor% bonus in the current tables — character.armorPercent IS the base
    armorPercent: additive(character.armorPercent, 0, 0),
    critChance: additive(weapon.critChance + character.critChance, equipTotals.critChancePercent, passives.critChance),
    critDamage: additive(weapon.critDamage + character.critDamage, equipTotals.critDamagePercent, passives.critDamagePercent),
    reloadTime: { base: weapon.reloadTime, bonusPercent: -passives.reloadSpeedPercent, equipmentBonusPercent: 0, passiveBonusPercent: -passives.reloadSpeedPercent, final: Math.max(0.2, weapon.reloadTime * (1 - passives.reloadSpeedPercent / 100)) },
    fireRate: multiplicative(weapon.fireRate, 0, passives.fireRatePercent),
    dailyAmmo: multiplicative(weapon.dailyAmmo, 0, passives.dailyAmmoPercent),
    shieldMax: equipTotals.shieldValue,
  };
}

export function statsToLoadout(character: CharacterRow, weapon: WeaponRow, stats: FullStatBreakdown, remainingAmmo: number, skinId?: string): CombatLoadout {
  return {
    id: character.id,
    name: `${character.name} + ${weapon.name}`,
    weaponId: weapon.id,
    sprite: characterSkinSpritePath(character.sprite, skinId),
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
