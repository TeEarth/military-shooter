import type { WeaponRow } from "@/lib/google/weapon";

export interface EnemyData {
  id: string;
  weaponId: string;
  hp: number;
  coinReward: number;
  sprite: string;
  /** v16: turret-style enemy (e.g. enemy_turret) — never patrols or chases,
   *  just stands its ground and shoots at any range. */
  immobile: boolean;
  /** The full weapon config this enemy carries — its damage/fireRate/fireMode/
   *  accuracy/magazine/reload all come from here, same struct the player uses. */
  weapon: WeaponRow;
}

export interface EnemySpawn extends EnemyData {
  spawnX: number;
  spawnY: number;
}
