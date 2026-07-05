/** Shared by every weapon's bullet velocity (px/s) except the two named overrides
 *  below — no other weapon may set its own bullet speed. */
export const BASE_BULLET_SPEED = 900;

export function bulletSpeedForWeapon(weaponId: string): number {
  if (weaponId === "sniper") return BASE_BULLET_SPEED * 2;
  if (weaponId === "grenade_launcher") return BASE_BULLET_SPEED / 2;
  return BASE_BULLET_SPEED;
}

export const GAME_CONFIG = {
  name: "Military Shooter 2D",
  version: "1.0.0",
  width: 960,
  height: 540,
  backgroundColor: "#1a1a2e",
  targetFPS: 60,
  physics: {
    gravity: 0,
    debug: false,
  },
  camera: {
    zoom: 1,
    lerp: 0.1,
  },
} as const;
