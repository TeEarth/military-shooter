import { getCachedSheet } from "./cache";

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
}

function rowToEnemy(row: Record<string, string>): EnemyRow {
  return {
    id: row.id,
    weaponId: row.weaponId,
    hp: Number(row.hp || 100),
    coinReward: Number(row.coinReward || 1),
    sprite: row.sprite || "",
  };
}

export async function getAllEnemies(): Promise<EnemyRow[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToEnemy);
}

export async function getEnemyById(id: string): Promise<EnemyRow | null> {
  const enemies = await getAllEnemies();
  return enemies.find((e) => e.id === id) ?? null;
}
