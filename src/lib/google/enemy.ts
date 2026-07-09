import { getConfigRows } from "../db/configCache";
import { parseBool } from "./sheet";

const SHEET = "Enemies";

export interface EnemyRow {
  id: string;
  /** Which Weapons-sheet row this enemy carries — its damage/fireRate/accuracy/
   *  magazine/reload/fireMode all come from that weapon, not from this row.
   *  This is the extension point: add a new enemy type by adding a row here
   *  referencing any existing (or new) weapon, no code change needed. */
  weaponId: string;
  hp: number;
  coinReward: number;
  sprite: string;
  /** v16: turret-style enemy (e.g. enemy_turret) — never patrols or chases. */
  immobile: boolean;
  /** v20: per-enemy damage scaling on top of its weapon's base damage — e.g.
   *  1.5 means this enemy hits 50% harder than a player using the same
   *  weapon would. Blank/missing defaults to 1 (no change), so every
   *  pre-v20 enemy row keeps behaving exactly as before. */
  damageMultiplier: number;
}

function rowToEnemy(row: Record<string, string>): EnemyRow {
  return {
    id: row.id,
    weaponId: row.weaponId,
    hp: Number(row.hp || 100),
    coinReward: Number(row.coinReward || 1),
    sprite: row.sprite || "",
    immobile: parseBool(row.immobile),
    damageMultiplier: Number(row.damageMultiplier) || 1,
  };
}

export async function getAllEnemies(): Promise<EnemyRow[]> {
  const rows = await getConfigRows(SHEET);
  return rows.map(rowToEnemy);
}

export async function getEnemyById(id: string): Promise<EnemyRow | null> {
  const enemies = await getAllEnemies();
  return enemies.find((e) => e.id === id) ?? null;
}
