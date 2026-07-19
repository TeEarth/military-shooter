export type FireMode = "single" | "burst" | "spread" | "aoe" | "lob";

/**
 * The merged stat block actually sent to the Phaser game for a play session.
 * Assembled server-side in /api/game/start/route.ts from four sources:
 *   - hpMax / moveSpeed / regenPer5s / sprite                  <- equipped Character
 *   - damage / fireRate / fireMode / projectileCount / accuracy /
 *     reloadTime / magazineSize / criticalChance / criticalDamage /
 *     bulletSprite                                            <- equipped Weapon
 *   - hp / armorPercent / damage / critChance / accuracy /
 *     speed bonuses                                           <- summed equipped Equipment
 *   - hpPercent / damagePercent / fireRatePercent / reloadSpeedPercent /
 *     critChance / critDamagePercent / accuracy / dailyAmmoPercent
 *                                                               <- Passive tiers (global multipliers)
 */
export interface CombatLoadout {
  id: string;
  name: string;
  weaponId: string;
  sprite: string;
  bulletSprite: string;
  /** Total cosmetic spread arc in degrees for this weapon's fire mode — see WeaponFire.ts. */
  spreadDegrees: number;

  hpMax: number;
  /** v60: raw equipped-gear shield points boosted by the character's total
   *  Armor% (character + skin, e.g. the Elite skin) — a separate absorb-first
   *  pool, not a % of HP. Armor% itself no longer reduces incoming damage
   *  directly (see Player.ts takeDamage); this value already has that bonus
   *  baked in by the time it reaches the client. */
  shieldMax: number;
  moveSpeed: number;
  regenPer5s: number;

  damage: number;
  fireRate: number;
  fireMode: FireMode;
  projectileCount: number;
  accuracy: number;
  reloadTime: number;
  magazineSize: number;
  criticalChance: number;
  criticalDamage: number;
  /** AoE splash radius in px — only meaningful for "aoe"/"lob" fireMode. */
  explosionRadius: number;

  /** Reserve ammo remaining today for the equipped weapon (PlayerWeaponAmmo). */
  ammo: number;
}
