import { getConfigRows } from "../db/configCache";

const EQUIPMENT_SHEET = "Equipment";

// ---------- Equipment catalog ----------
// v16: this file used to also contain PlayerCharacter/PlayerWeapon/
// PlayerEquipment/PlayerEquipmentLevel read/write functions backed directly
// by Google Sheets — those were fully superseded by the Supabase-backed
// versions in src/lib/db/inventory.ts during the v12 migration and had been
// dead code (zero imports) ever since. Removed as part of the v16 cleanup;
// this file now only holds the Equipment CONFIG catalog, which is still
// legitimately read from Sheets (via the config cache) until the pending
// game_config Supabase migration ships.

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
  const rows = await getConfigRows(EQUIPMENT_SHEET);
  return rows.map(rowToEquipment);
}

export async function getEquipmentById(id: string): Promise<EquipmentRow | null> {
  const items = await getAllEquipment();
  return items.find((e) => e.id === id) ?? null;
}
