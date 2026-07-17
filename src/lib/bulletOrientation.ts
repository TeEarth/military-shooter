/**
 * Bullet SVGs are drawn in whatever orientation reads best as static art —
 * bullet_round/bullet_grenade are portrait viewBoxes (tip/pin pointing up),
 * bullet_rocket/bullet_razor are landscape (nose/core pointing right,
 * matching Phaser's rotation-angle-0 convention). WeaponFire.ts's
 * setRotation(travelAngle) assumes every sprite's un-rotated art already
 * points right, so the portrait ones need a +90° correction — without it,
 * a bullet traveling in a given direction shows its art's fixed default
 * orientation instead of actually facing where it's flying.
 */
export function bulletRotationOffset(bulletSpritePath: string): number {
  if (bulletSpritePath.endsWith("bullet_round.svg") || bulletSpritePath.endsWith("bullet_grenade.svg")) {
    return Math.PI / 2;
  }
  return 0;
}

/** Preserves each bullet SVG's real aspect ratio (round/grenade are portrait,
 *  rocket/razor are landscape) instead of forcing every bullet into the same
 *  square texture — squishing an elongated sprite into a square is exactly
 *  what made travel direction unreadable regardless of rotation. */
export function bulletDisplaySize(bulletSpritePath: string): { width: number; height: number } {
  if (bulletSpritePath.endsWith("bullet_round.svg")) return { width: 9, height: 16 };
  if (bulletSpritePath.endsWith("bullet_rocket.svg")) return { width: 32, height: 17 };
  if (bulletSpritePath.endsWith("bullet_razor.svg")) return { width: 36, height: 8 };
  if (bulletSpritePath.endsWith("bullet_grenade.svg")) return { width: 20, height: 25 };
  return { width: 12, height: 12 };
}
