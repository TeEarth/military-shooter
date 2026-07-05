import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, findRows, updateRow, parseBool } from "./sheet";
import { DUPE_UPGRADE_BONUS } from "../../../config/equipment";

const PLAYER_CHARACTER_SHEET = "PlayerCharacter";
const PLAYER_EQUIPMENT_SHEET = "PlayerEquipment";
const PLAYER_EQUIPMENT_LEVEL_SHEET = "PlayerEquipmentLevel";
const PLAYER_WEAPON_SHEET = "PlayerWeapon";
const EQUIPMENT_SHEET = "Equipment";

// ---------- Equipment catalog ----------

export type EquipmentSlot = "helmet" | "vest" | "boots";
export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface EquipmentRow {
  id: string;
  name: string;
  slot: EquipmentSlot;
  rarity: Rarity;
  /** All bonuses are percentages, applied per the formulas in src/lib/stats.ts
   *  (HP/damage multiply a base stat; critChance/critDamage add directly). */
  hpPercent: number;
  damagePercent: number;
  critChancePercent: number;
  critDamagePercent: number;
  /** Flat raw shield points (NOT a percentage, no dupe/passive scaling) — see src/lib/stats.ts. */
  shieldValue: number;
  sprite: string;
}

function rowToEquipment(row: Record<string, string>): EquipmentRow {
  return {
    id: row.id,
    name: row.name || row.id,
    slot: (row.slot || "helmet") as EquipmentSlot,
    rarity: (row.rarity || "common") as Rarity,
    hpPercent: Number(row.hpPercent || 0),
    damagePercent: Number(row.damagePercent || 0),
    critChancePercent: Number(row.critChancePercent || 0),
    critDamagePercent: Number(row.critDamagePercent || 0),
    shieldValue: Number(row.shieldValue || 0),
    sprite: row.sprite || "",
  };
}

export async function getAllEquipment(): Promise<EquipmentRow[]> {
  const { rows } = await getCachedSheet(EQUIPMENT_SHEET);
  return rows.map(rowToEquipment);
}

export async function getEquipmentById(id: string): Promise<EquipmentRow | null> {
  const items = await getAllEquipment();
  return items.find((e) => e.id === id) ?? null;
}

// ---------- PlayerCharacter (ownership) ----------

export interface PlayerCharacterRow {
  playerId: string;
  characterId: string;
  owned: boolean;
}

export async function getPlayerCharacters(playerId: string): Promise<PlayerCharacterRow[]> {
  const rows = await findRows(PLAYER_CHARACTER_SHEET, (r) => r.playerId === playerId);
  return rows.map((r) => ({ playerId: r.playerId, characterId: r.characterId, owned: parseBool(r.owned) }));
}

export async function ownsCharacter(playerId: string, characterId: string): Promise<boolean> {
  const found = await findRow(PLAYER_CHARACTER_SHEET, (r) => r.playerId === playerId && r.characterId === characterId);
  return !!found && parseBool(found.row.owned);
}

export async function unlockCharacterForPlayer(playerId: string, characterId: string): Promise<void> {
  try {
    const found = await findRow(PLAYER_CHARACTER_SHEET, (r) => r.playerId === playerId && r.characterId === characterId);
    if (found) {
      await updateRow(PLAYER_CHARACTER_SHEET, found.rowIndex, { owned: true });
    } else {
      await appendRow(PLAYER_CHARACTER_SHEET, { playerId, characterId, owned: true });
    }
    invalidateSheetCache(PLAYER_CHARACTER_SHEET);
  } catch (e) {
    throw new Error(`Failed to grant character ${characterId}: ${(e as Error).message}`);
  }
}

// ---------- PlayerWeapon (ownership + equip) ----------

export interface PlayerWeaponRow {
  playerId: string;
  weaponId: string;
  owned: boolean;
  equipped: boolean;
}

export async function getPlayerWeapons(playerId: string): Promise<PlayerWeaponRow[]> {
  const rows = await findRows(PLAYER_WEAPON_SHEET, (r) => r.playerId === playerId);
  return rows.map((r) => ({ playerId: r.playerId, weaponId: r.weaponId, owned: parseBool(r.owned), equipped: parseBool(r.equipped) }));
}

export async function ownsWeapon(playerId: string, weaponId: string): Promise<boolean> {
  const found = await findRow(PLAYER_WEAPON_SHEET, (r) => r.playerId === playerId && r.weaponId === weaponId);
  return !!found && parseBool(found.row.owned);
}

export async function getEquippedWeaponId(playerId: string): Promise<string | null> {
  const weapons = await getPlayerWeapons(playerId);
  return weapons.find((w) => w.equipped)?.weaponId ?? null;
}

export async function grantWeaponToPlayer(playerId: string, weaponId: string): Promise<void> {
  try {
    const found = await findRow(PLAYER_WEAPON_SHEET, (r) => r.playerId === playerId && r.weaponId === weaponId);
    if (found) {
      await updateRow(PLAYER_WEAPON_SHEET, found.rowIndex, { owned: true });
    } else {
      await appendRow(PLAYER_WEAPON_SHEET, { playerId, weaponId, owned: true, equipped: false });
    }
    invalidateSheetCache(PLAYER_WEAPON_SHEET);
  } catch (e) {
    throw new Error(`Failed to grant weapon ${weaponId}: ${(e as Error).message}`);
  }
}

/** Equips one weapon and unequips any other weapon the player has equipped (single active weapon at a time). */
export async function setWeaponEquipped(playerId: string, weaponId: string): Promise<void> {
  const owned = await ownsWeapon(playerId, weaponId);
  if (!owned) throw new Error("Weapon not owned");

  const weapons = await getPlayerWeapons(playerId);
  for (const w of weapons) {
    if (w.equipped && w.weaponId !== weaponId) {
      const found = await findRow(PLAYER_WEAPON_SHEET, (r) => r.playerId === playerId && r.weaponId === w.weaponId);
      if (found) await updateRow(PLAYER_WEAPON_SHEET, found.rowIndex, { equipped: false });
    }
  }

  const target = await findRow(PLAYER_WEAPON_SHEET, (r) => r.playerId === playerId && r.weaponId === weaponId);
  if (target) await updateRow(PLAYER_WEAPON_SHEET, target.rowIndex, { equipped: true });
  invalidateSheetCache(PLAYER_WEAPON_SHEET);
}

// ---------- PlayerEquipment ----------

export interface PlayerEquipmentRow {
  playerId: string;
  equipmentId: string;
  slot: EquipmentSlot;
  equipped: boolean;
}

export async function getPlayerEquipment(playerId: string): Promise<PlayerEquipmentRow[]> {
  const rows = await findRows(PLAYER_EQUIPMENT_SHEET, (r) => r.playerId === playerId);
  return rows.map((r) => ({ playerId: r.playerId, equipmentId: r.equipmentId, slot: (r.slot || "helmet") as EquipmentSlot, equipped: parseBool(r.equipped) }));
}

export async function ownsEquipment(playerId: string, equipmentId: string): Promise<boolean> {
  const found = await findRow(PLAYER_EQUIPMENT_SHEET, (r) => r.playerId === playerId && r.equipmentId === equipmentId);
  return !!found;
}

export async function grantEquipmentToPlayer(playerId: string, equipmentId: string): Promise<void> {
  try {
    const found = await findRow(PLAYER_EQUIPMENT_SHEET, (r) => r.playerId === playerId && r.equipmentId === equipmentId);
    if (!found) {
      const item = await getEquipmentById(equipmentId);
      await appendRow(PLAYER_EQUIPMENT_SHEET, { playerId, equipmentId, slot: item?.slot ?? "helmet", equipped: false });
      invalidateSheetCache(PLAYER_EQUIPMENT_SHEET);
    }
  } catch (e) {
    throw new Error(`Failed to grant equipment ${equipmentId}: ${(e as Error).message}`);
  }
}

/** Equips one item into its slot, unequipping whatever else already occupies that slot (one item per slot). */
export async function setEquipped(playerId: string, equipmentId: string, equipped: boolean): Promise<void> {
  const found = await findRow(PLAYER_EQUIPMENT_SHEET, (r) => r.playerId === playerId && r.equipmentId === equipmentId);
  if (!found) throw new Error("Equipment not owned");

  if (equipped) {
    const slot = found.row.slot as EquipmentSlot;
    const owned = await getPlayerEquipment(playerId);
    for (const row of owned) {
      if (row.equipped && row.equipmentId !== equipmentId && row.slot === slot) {
        const otherRow = await findRow(PLAYER_EQUIPMENT_SHEET, (r) => r.playerId === playerId && r.equipmentId === row.equipmentId);
        if (otherRow) await updateRow(PLAYER_EQUIPMENT_SHEET, otherRow.rowIndex, { equipped: false });
      }
    }
  }

  await updateRow(PLAYER_EQUIPMENT_SHEET, found.rowIndex, { equipped });
  invalidateSheetCache(PLAYER_EQUIPMENT_SHEET);
}

// ---------- PlayerEquipmentLevel (gacha dupe upgrades) ----------

export async function getEquipmentUpgradeLevel(playerId: string, equipmentId: string): Promise<number> {
  const found = await findRow(PLAYER_EQUIPMENT_LEVEL_SHEET, (r) => r.playerId === playerId && r.equipmentId === equipmentId);
  return found ? Number(found.row.upgradeLevel || 0) : 0;
}

export async function getAllEquipmentUpgradeLevels(playerId: string): Promise<Record<string, number>> {
  const rows = await findRows(PLAYER_EQUIPMENT_LEVEL_SHEET, (r) => r.playerId === playerId);
  const levels: Record<string, number> = {};
  for (const r of rows) levels[r.equipmentId] = Number(r.upgradeLevel || 0);
  return levels;
}

/** A gacha dupe pull guarantees +1 upgrade level for that item — no extra currency cost. */
export async function incrementEquipmentUpgradeLevel(playerId: string, equipmentId: string): Promise<number> {
  const found = await findRow(PLAYER_EQUIPMENT_LEVEL_SHEET, (r) => r.playerId === playerId && r.equipmentId === equipmentId);
  const newLevel = found ? Number(found.row.upgradeLevel || 0) + 1 : 1;
  if (found) {
    await updateRow(PLAYER_EQUIPMENT_LEVEL_SHEET, found.rowIndex, { upgradeLevel: newLevel });
  } else {
    await appendRow(PLAYER_EQUIPMENT_LEVEL_SHEET, { playerId, equipmentId, upgradeLevel: newLevel });
  }
  invalidateSheetCache(PLAYER_EQUIPMENT_LEVEL_SHEET);
  return newLevel;
}

// ---------- Aggregate equipped stat totals ----------

export interface EquipmentStatTotals {
  hpPercent: number;
  damagePercent: number;
  critChancePercent: number;
  critDamagePercent: number;
  /** Flat sum of equipped shieldValue — a raw point total, never scaled by dupe level or passives. */
  shieldValue: number;
}

/** Sums base rarity bonus + dupe-upgrade bonus of every currently-equipped item. */
export async function getEquippedStatTotals(playerId: string): Promise<EquipmentStatTotals> {
  const [owned, catalog, upgradeLevels] = await Promise.all([
    getPlayerEquipment(playerId),
    getAllEquipment(),
    getAllEquipmentUpgradeLevels(playerId),
  ]);

  const totals: EquipmentStatTotals = { hpPercent: 0, damagePercent: 0, critChancePercent: 0, critDamagePercent: 0, shieldValue: 0 };

  for (const row of owned) {
    if (!row.equipped) continue;
    const item = catalog.find((c) => c.id === row.equipmentId);
    if (!item) continue;

    const level = upgradeLevels[item.id] ?? 0;
    const dupe = DUPE_UPGRADE_BONUS[item.rarity];

    totals.hpPercent += item.hpPercent + level * dupe.hpPercent;
    totals.damagePercent += item.damagePercent + level * dupe.damagePercent;
    totals.critChancePercent += item.critChancePercent + level * dupe.critChancePercent;
    totals.critDamagePercent += item.critDamagePercent + level * dupe.critDamagePercent;
    totals.shieldValue += item.shieldValue;
  }

  return totals;
}
