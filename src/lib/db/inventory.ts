import { getSupabaseClient } from "../supabase/client";
import { DUPE_UPGRADE_BONUS } from "../../../config/equipment";
// Equipment/Weapon/Character CATALOGS are config data — still Google Sheets,
// synced periodically per the v10 plan. Only per-player ownership/equip state
// below lives in Supabase. Re-exported here so callers only need one import.
export { getAllEquipment, getEquipmentById, type EquipmentRow, type EquipmentSlot, type Rarity } from "../google/inventory";
import { getAllEquipment, type EquipmentSlot, type Rarity } from "../google/inventory";

const PLAYER_CHARACTER = "player_character";
const PLAYER_WEAPON = "player_weapon";
const PLAYER_EQUIPMENT = "player_equipment";
const PLAYER_EQUIPMENT_LEVEL = "player_equipment_level";

// ---------- PlayerCharacter (ownership) ----------

export interface PlayerCharacterRow {
  playerId: string;
  characterId: string;
  owned: boolean;
}

export async function getPlayerCharacters(playerId: string): Promise<PlayerCharacterRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_CHARACTER).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getPlayerCharacters: ${error.message}`);
  return (data ?? []).map((r) => ({ playerId: r.player_id, characterId: r.character_id, owned: Boolean(r.owned) }));
}

export async function ownsCharacter(playerId: string, characterId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_CHARACTER).select("owned").eq("player_id", playerId).eq("character_id", characterId).maybeSingle();
  if (error) throw new Error(`ownsCharacter: ${error.message}`);
  return Boolean(data?.owned);
}

export async function unlockCharacterForPlayer(playerId: string, characterId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(PLAYER_CHARACTER).upsert({ player_id: playerId, character_id: characterId, owned: true });
  if (error) throw new Error(`Failed to grant character ${characterId}: ${error.message}`);
}

// ---------- PlayerWeapon (ownership + equip) ----------

export interface PlayerWeaponRow {
  playerId: string;
  weaponId: string;
  owned: boolean;
  equipped: boolean;
}

export async function getPlayerWeapons(playerId: string): Promise<PlayerWeaponRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_WEAPON).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getPlayerWeapons: ${error.message}`);
  return (data ?? []).map((r) => ({ playerId: r.player_id, weaponId: r.weapon_id, owned: Boolean(r.owned), equipped: Boolean(r.equipped) }));
}

export async function ownsWeapon(playerId: string, weaponId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_WEAPON).select("owned").eq("player_id", playerId).eq("weapon_id", weaponId).maybeSingle();
  if (error) throw new Error(`ownsWeapon: ${error.message}`);
  return Boolean(data?.owned);
}

export async function getEquippedWeaponId(playerId: string): Promise<string | null> {
  const weapons = await getPlayerWeapons(playerId);
  return weapons.find((w) => w.equipped)?.weaponId ?? null;
}

export async function grantWeaponToPlayer(playerId: string, weaponId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(PLAYER_WEAPON).upsert({ player_id: playerId, weapon_id: weaponId, owned: true }, { onConflict: "player_id,weapon_id", ignoreDuplicates: false });
  if (error) throw new Error(`Failed to grant weapon ${weaponId}: ${error.message}`);
}

/** Equips one weapon and unequips any other weapon the player has equipped (single active weapon at a time). */
export async function setWeaponEquipped(playerId: string, weaponId: string): Promise<void> {
  const owned = await ownsWeapon(playerId, weaponId);
  if (!owned) throw new Error("Weapon not owned");

  const supabase = getSupabaseClient();
  const { error: unequipError } = await supabase.from(PLAYER_WEAPON).update({ equipped: false }).eq("player_id", playerId).neq("weapon_id", weaponId);
  if (unequipError) throw new Error(`setWeaponEquipped (unequip others): ${unequipError.message}`);

  const { error } = await supabase.from(PLAYER_WEAPON).update({ equipped: true }).eq("player_id", playerId).eq("weapon_id", weaponId);
  if (error) throw new Error(`setWeaponEquipped: ${error.message}`);
}

// ---------- PlayerEquipment ----------

export interface PlayerEquipmentRow {
  playerId: string;
  equipmentId: string;
  slot: EquipmentSlot;
  equipped: boolean;
}

export async function getPlayerEquipment(playerId: string): Promise<PlayerEquipmentRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_EQUIPMENT).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getPlayerEquipment: ${error.message}`);
  return (data ?? []).map((r) => ({ playerId: r.player_id, equipmentId: r.equipment_id, slot: (r.slot || "helmet") as EquipmentSlot, equipped: Boolean(r.equipped) }));
}

export async function ownsEquipment(playerId: string, equipmentId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_EQUIPMENT).select("player_id").eq("player_id", playerId).eq("equipment_id", equipmentId).maybeSingle();
  if (error) throw new Error(`ownsEquipment: ${error.message}`);
  return Boolean(data);
}

export async function grantEquipmentToPlayer(playerId: string, equipmentId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const alreadyOwned = await ownsEquipment(playerId, equipmentId);
  if (alreadyOwned) return;
  const { getEquipmentById } = await import("../google/inventory");
  const item = await getEquipmentById(equipmentId);
  const { error } = await supabase.from(PLAYER_EQUIPMENT).insert({ player_id: playerId, equipment_id: equipmentId, slot: item?.slot ?? "helmet", equipped: false });
  if (error) throw new Error(`Failed to grant equipment ${equipmentId}: ${error.message}`);
}

/** Equips one item into its slot, unequipping whatever else already occupies that slot (one item per slot). */
export async function setEquipped(playerId: string, equipmentId: string, equipped: boolean): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: found, error: findError } = await supabase.from(PLAYER_EQUIPMENT).select("*").eq("player_id", playerId).eq("equipment_id", equipmentId).maybeSingle();
  if (findError) throw new Error(`setEquipped: ${findError.message}`);
  if (!found) throw new Error("Equipment not owned");

  if (equipped) {
    const { error: unequipError } = await supabase
      .from(PLAYER_EQUIPMENT)
      .update({ equipped: false })
      .eq("player_id", playerId)
      .eq("slot", found.slot)
      .neq("equipment_id", equipmentId);
    if (unequipError) throw new Error(`setEquipped (unequip slot): ${unequipError.message}`);
  }

  const { error } = await supabase.from(PLAYER_EQUIPMENT).update({ equipped }).eq("player_id", playerId).eq("equipment_id", equipmentId);
  if (error) throw new Error(`setEquipped: ${error.message}`);
}

// ---------- PlayerEquipmentLevel (gacha dupe upgrades) ----------

export async function getEquipmentUpgradeLevel(playerId: string, equipmentId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_EQUIPMENT_LEVEL).select("upgrade_level").eq("player_id", playerId).eq("equipment_id", equipmentId).maybeSingle();
  if (error) throw new Error(`getEquipmentUpgradeLevel: ${error.message}`);
  return Number(data?.upgrade_level ?? 0);
}

export async function getAllEquipmentUpgradeLevels(playerId: string): Promise<Record<string, number>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(PLAYER_EQUIPMENT_LEVEL).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getAllEquipmentUpgradeLevels: ${error.message}`);
  const levels: Record<string, number> = {};
  for (const r of data ?? []) levels[r.equipment_id] = Number(r.upgrade_level ?? 0);
  return levels;
}

/** A gacha dupe pull guarantees +1 upgrade level for that item — no extra currency cost. */
export async function incrementEquipmentUpgradeLevel(playerId: string, equipmentId: string): Promise<number> {
  const current = await getEquipmentUpgradeLevel(playerId, equipmentId);
  const newLevel = current + 1;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(PLAYER_EQUIPMENT_LEVEL).upsert({ player_id: playerId, equipment_id: equipmentId, upgrade_level: newLevel });
  if (error) throw new Error(`incrementEquipmentUpgradeLevel: ${error.message}`);
  return newLevel;
}

// ---------- Aggregate equipped stat totals ----------

export interface EquipmentStatTotals {
  hpPercent: number;
  damagePercent: number;
  critChancePercent: number;
  critDamagePercent: number;
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
    const dupe = DUPE_UPGRADE_BONUS[item.rarity as Rarity];

    totals.hpPercent += item.hpPercent + level * dupe.hpPercent;
    totals.damagePercent += item.damagePercent + level * dupe.damagePercent;
    totals.critChancePercent += item.critChancePercent + level * dupe.critChancePercent;
    totals.critDamagePercent += item.critDamagePercent + level * dupe.critDamagePercent;
    totals.shieldValue += item.shieldValue;
  }

  return totals;
}
