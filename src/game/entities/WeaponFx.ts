import Phaser from "phaser";

/**
 * Shared fire-feedback effects for both Player.ts and Enemy.ts — recoil kick
 * and muzzle effects keyed off the shooter's actual equipped bulletSprite
 * path (same convention as bulletOrientation.ts). Enemies render their
 * projectile as a plain generated circle regardless of weapon (see
 * Enemy.ts's tryShoot), but still pass their real weapon.sprite path here
 * purely to pick the right muzzle effect — the effect is about the GUN
 * being fired, not the projectile flying.
 */

/** How far back (px) a single shot kicks the weapon sprite, and how fast
 *  that kick decays back to 0 — recovers over roughly RECOIL_KICK_PX /
 *  RECOIL_RECOVERY_RATE ms (~170ms at these values), fast enough that rapid
 *  automatic fire reads as a continuous jitter rather than one big kick. */
export const RECOIL_KICK_PX = 6;
const RECOIL_RECOVERY_RATE = 0.035;

export function decayRecoil(current: number, deltaMs: number): number {
  return Math.max(0, current - RECOIL_RECOVERY_RATE * deltaMs);
}

const MUZZLE_OFFSET_PX = 18;

/** Spawns the appropriate one-shot muzzle effect for this weapon's bullet
 *  type at the shooter's current position/aim angle — shell casing eject for
 *  bullet_round (the vast majority of weapons), a smoke puff for the two
 *  explosive launchers (bullet_rocket/bullet_grenade), or a bright flash for
 *  the energy weapon (bullet_razor). No effect for an unrecognized path. */
export function spawnMuzzleEffect(scene: Phaser.Scene, originX: number, originY: number, angle: number, bulletSpritePath: string) {
  const mx = originX + Math.cos(angle) * MUZZLE_OFFSET_PX;
  const my = originY + Math.sin(angle) * MUZZLE_OFFSET_PX;

  if (bulletSpritePath.endsWith("bullet_round.svg")) {
    spawnShellCasing(scene, mx, my, angle);
  } else if (bulletSpritePath.endsWith("bullet_rocket.svg") || bulletSpritePath.endsWith("bullet_grenade.svg")) {
    spawnSmokePuff(scene, mx, my);
  } else if (bulletSpritePath.endsWith("bullet_razor.svg")) {
    spawnMuzzleFlash(scene, mx, my);
  }
}

function spawnShellCasing(scene: Phaser.Scene, x: number, y: number, angle: number) {
  // Ejects roughly sideways off the barrel (perpendicular to travel, with a
  // little randomness) and tumbles as it falls away, fading out.
  const ejectAngle = angle + Math.PI / 2 * Phaser.Math.RND.pick([-1, 1]) + Phaser.Math.FloatBetween(-0.25, 0.25);
  const dist = Phaser.Math.Between(14, 22);
  const casing = scene.add.rectangle(x, y, 4, 2, 0xd4af37).setDepth(50).setRotation(angle);
  scene.tweens.add({
    targets: casing,
    x: x + Math.cos(ejectAngle) * dist,
    y: y + Math.sin(ejectAngle) * dist + 8,
    rotation: casing.rotation + Phaser.Math.FloatBetween(3, 6),
    alpha: 0,
    duration: 420,
    ease: "Cubic.Out",
    onComplete: () => casing.destroy(),
  });
}

function spawnSmokePuff(scene: Phaser.Scene, x: number, y: number) {
  for (let i = 0; i < 3; i++) {
    const puff = scene.add.circle(x, y, Phaser.Math.Between(4, 7), 0xaaaaaa, 0.5).setDepth(49);
    const dx = Phaser.Math.FloatBetween(-8, 8);
    const dy = Phaser.Math.FloatBetween(-10, -2);
    scene.tweens.add({
      targets: puff,
      x: x + dx,
      y: y + dy,
      scale: 2.2,
      alpha: 0,
      duration: 500 + i * 60,
      ease: "Sine.Out",
      onComplete: () => puff.destroy(),
    });
  }
}

function spawnMuzzleFlash(scene: Phaser.Scene, x: number, y: number) {
  const flash = scene.add.circle(x, y, 10, 0x0af0ff, 0.85).setDepth(51);
  scene.tweens.add({
    targets: flash,
    scale: 1.8,
    alpha: 0,
    duration: 120,
    ease: "Cubic.Out",
    onComplete: () => flash.destroy(),
  });
}

/** Reload wiggle — a small oscillating rotation/position applied to the
 *  weapon sprite for the whole reload duration, reading as someone actively
 *  working the gun (removing/seating a magazine) rather than it just
 *  standing frozen for a few seconds. `progressMs` is how far into the
 *  reload we are (any monotonically-increasing time value, e.g. scene time). */
export function reloadWiggle(progressMs: number): { dx: number; dy: number; dRotation: number } {
  return {
    dx: Math.sin(progressMs / 70) * 1.6,
    dy: Math.abs(Math.sin(progressMs / 140)) * 2.2,
    dRotation: Math.sin(progressMs / 90) * 0.12,
  };
}
