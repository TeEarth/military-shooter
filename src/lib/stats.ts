import type { CharacterRow } from "./google/character";
import type { WeaponRow } from "./google/weapon";
import type { EquipmentStatTotals } from "./db/inventory";
import { getEquippedStatTotals } from "./db/inventory";
import { getPassiveTotals, type PassiveTotals } from "./db/passive";
import { getPlayerById } from "./db/player";
import { getUpgradedBaseHp } from "./characterUpgrade";
import { getUpgradedBaseDamage } from "./weaponUpgrade";
import type { CombatLoadout } from "@/types/loadout";
import { characterSkinSpritePath, getEquippedSkin, SKIN_STAT_BONUS, type SkinId, type SkinBonusStat } from "./characterSkins";

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
  /** Combined bonus % (equipment + passive + skin) — kept for the final-value formula. */
  bonusPercent: number;
  /** v13: equipment and passive bonuses shown SEPARATELY in the UI, not just
   *  merged — so a player can see "gear gives +12%, passives give +8%"
   *  instead of one opaque "+20%". Always 0 for stats equipment/passives
   *  don't contribute to (e.g. moveSpeed). */
  equipmentBonusPercent: number;
  passiveBonusPercent: number;
  /** v61: the equipped skin's stat bonus (see SKIN_STAT_BONUS in
   *  characterSkins.ts), shown as its own tag same as equipment/passive.
   *  Always 0 for stats the equipped skin doesn't boost. */
  skinBonusPercent: number;
  final: number;
}

/** v61: Total Shield is no longer a flat number — Armor% (character + skin,
 *  e.g. Elite) now boosts it directly instead of reducing incoming damage
 *  (see Player.ts takeDamage). base is the raw point sum from equipped gear;
 *  armorBonusPercent is the FINAL armor% stat applied as a shield multiplier. */
export interface ShieldLine {
  base: number;
  armorBonusPercent: number;
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
  shieldMax: ShieldLine;
}

function multiplicative(base: number, equipmentBonusPercent: number, passiveBonusPercent: number, skinBonusPercent = 0): StatLine {
  const bonusPercent = equipmentBonusPercent + passiveBonusPercent + skinBonusPercent;
  return { base, bonusPercent, equipmentBonusPercent, passiveBonusPercent, skinBonusPercent, final: base * (1 + bonusPercent / 100) };
}

/** For stats that are already percentages: every source is summed as a flat addend, uncapped. */
function additive(base: number, equipmentBonusPercent: number, passiveBonusPercent: number, skinBonusPercent = 0): StatLine {
  const bonusPercent = equipmentBonusPercent + passiveBonusPercent + skinBonusPercent;
  return { base, bonusPercent, equipmentBonusPercent, passiveBonusPercent, skinBonusPercent, final: base + bonusPercent };
}

/** v61: every skin bonus is "10% of that stat's OWN existing total", scaled
 *  off the character's own contribution — never the weapon's or equipment's
 *  (see SKIN_STAT_BONUS's doc comment in characterSkins.ts). Returns 0 if
 *  the equipped skin doesn't boost this particular stat. */
function skinBonusFor(skinId: SkinId | undefined, stat: SkinBonusStat, characterOwnValue: number): number {
  if (!skinId) return 0;
  const bonus = SKIN_STAT_BONUS[skinId];
  if (!bonus || bonus.stat !== stat) return 0;
  return characterOwnValue * (bonus.percentOfBase / 100);
}

export async function computeFullStats(playerId: string, character: CharacterRow, weapon: WeaponRow): Promise<FullStatBreakdown> {
  const [equipTotals, passives, player] = await Promise.all([
    getEquippedStatTotals(playerId),
    getPassiveTotals(playerId),
    getPlayerById(playerId),
  ]);
  const characterUpgradeLevel = player?.characterUpgradeLevels[character.id] ?? 0;
  const weaponUpgradeLevel = player?.weaponUpgradeLevels[weapon.id] ?? 0;
  const skinId = player ? getEquippedSkin(player.skinColors, character.id) : undefined;

  return buildStatBreakdown(character, weapon, equipTotals, passives, characterUpgradeLevel, weaponUpgradeLevel, skinId);
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
  weaponUpgradeLevel = 0,
  /** v61: the character's equipped skin id (see characterSkins.ts) — drives
   *  each skin's own +10% stat bonus. Undefined/"default" contributes 0
   *  everywhere. */
  skinId?: SkinId
): FullStatBreakdown {
  const upgradedBaseHp = getUpgradedBaseHp(character.hpMax, characterUpgradeLevel);
  const upgradedBaseDamage = getUpgradedBaseDamage(weapon.damage, weaponUpgradeLevel);

  const hp = multiplicative(upgradedBaseHp, equipTotals.hpPercent, passives.hpPercent, skinBonusFor(skinId, "hp", upgradedBaseHp));
  const damage = multiplicative(upgradedBaseDamage, equipTotals.damagePercent, passives.damagePercent, skinBonusFor(skinId, "damage", upgradedBaseDamage));
  // equipment has no accuracy bonus in the current tables
  const accuracy = additive(weapon.accuracy + character.accuracy, 0, passives.accuracy, skinBonusFor(skinId, "accuracy", character.accuracy));
  // equipment/passives have no armor% bonus in the current tables — character.armorPercent IS the base
  const armorPercent = additive(character.armorPercent, 0, 0, skinBonusFor(skinId, "armorPercent", character.armorPercent));
  const critChance = additive(weapon.critChance + character.critChance, equipTotals.critChancePercent, passives.critChance, skinBonusFor(skinId, "critChance", character.critChance));

  return {
    hp,
    damage,
    moveSpeed: { base: character.speed, bonusPercent: 0, equipmentBonusPercent: 0, passiveBonusPercent: 0, skinBonusPercent: 0, final: character.speed },
    accuracy,
    armorPercent,
    critChance,
    critDamage: additive(weapon.critDamage + character.critDamage, equipTotals.critDamagePercent, passives.critDamagePercent),
    reloadTime: { base: weapon.reloadTime, bonusPercent: -passives.reloadSpeedPercent, equipmentBonusPercent: 0, passiveBonusPercent: -passives.reloadSpeedPercent, skinBonusPercent: 0, final: Math.max(0.2, weapon.reloadTime * (1 - passives.reloadSpeedPercent / 100)) },
    fireRate: multiplicative(weapon.fireRate, 0, passives.fireRatePercent),
    dailyAmmo: multiplicative(weapon.dailyAmmo, 0, passives.dailyAmmoPercent),
    // v61: Total Shield = raw equipped-gear points, boosted by the FINAL
    // armor% stat (character + skin) — this is armor%'s entire purpose now.
    shieldMax: { base: equipTotals.shieldValue, armorBonusPercent: armorPercent.final, final: equipTotals.shieldValue * (1 + armorPercent.final / 100) },
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
    shieldMax: Math.round(stats.shieldMax.final),
    moveSpeed: stats.moveSpeed.final,
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
