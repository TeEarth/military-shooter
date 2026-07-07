import { getConfigRows } from "../db/configCache";
import { PLAYER_CONFIG } from "../../../config/player";

const SHEET = "Weapons";

export type WeaponUnlockType = "FREE" | "STAGE" | "PURCHASE" | "DIAMOND" | "TICKET";
export type FireMode = "single" | "burst" | "spread" | "aoe" | "lob";

export interface WeaponRow {
  id: string;
  name: string;
  unlockType: WeaponUnlockType;
  unlockValue: number;
  priceCoin: number;
  priceDiamond: number;
  priceTicket: number;
  damage: number;
  fireRate: number;
  fireMode: FireMode;
  /** Pellet/burst count for spread and burst fire modes (1 for single/aoe/lob). */
  projectileCount: number;
  accuracy: number;
  magazineSize: number;
  reloadTime: number;
  critChance: number;
  critDamage: number;
  /** Total rounds carried per day across the whole magazine pool — see PlayerWeaponAmmo. */
  dailyAmmo: number;
  /** Total cosmetic spread arc in degrees (e.g. shotgun 5, gatling 2) — see WeaponFire.ts. */
  spreadDegrees: number;
  /** AoE splash radius in px (only meaningful for "aoe"/"lob" fireMode) — grenade_launcher is
   *  half of rocket_launcher's. Falls back to PLAYER_CONFIG.aoeRadius if not set on the sheet. */
  explosionRadius: number;
  sprite: string;
}

function rowToWeapon(row: Record<string, string>): WeaponRow {
  return {
    id: row.id,
    name: row.name,
    unlockType: (row.unlockType || "FREE") as WeaponUnlockType,
    unlockValue: Number(row.unlockValue || 0),
    priceCoin: Number(row.priceCoin || 0),
    priceDiamond: Number(row.priceDiamond || 0),
    priceTicket: Number(row.priceTicket || 0),
    damage: Number(row.damage || 10),
    fireRate: Number(row.fireRate || 1),
    fireMode: (row.fireMode || "single") as FireMode,
    projectileCount: Number(row.projectileCount || 1),
    accuracy: Number(row.accuracy || 50),
    magazineSize: Number(row.magazineSize || 10),
    reloadTime: Number(row.reloadTime || 3),
    critChance: Number(row.critChance || 0),
    critDamage: Number(row.critDamage || 0),
    dailyAmmo: Number(row.dailyAmmo || 100),
    spreadDegrees: Number(row.spreadDegrees ?? 3),
    explosionRadius: Number(row.explosionRadius || PLAYER_CONFIG.aoeRadius),
    sprite: row.sprite || "",
  };
}

export async function getAllWeapons(options?: { force?: boolean }): Promise<WeaponRow[]> {
  const rows = await getConfigRows(SHEET, options);
  return rows.map(rowToWeapon);
}

export async function getWeaponById(id: string): Promise<WeaponRow | null> {
  const weapons = await getAllWeapons();
  return weapons.find((w) => w.id === id) ?? null;
}

export function isWeaponFreelyUnlocked(weapon: WeaponRow, currentStage: number): boolean {
  if (weapon.unlockType === "FREE") return true;
  if (weapon.unlockType === "STAGE") return currentStage >= weapon.unlockValue;
  return false;
}
