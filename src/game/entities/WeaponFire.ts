import Phaser from "phaser";
import type { FireMode } from "@/types/loadout";
import { bulletRotationOffset } from "@/lib/bulletOrientation";

export interface FireStats {
  damage: number;
  fireMode: FireMode;
  projectileCount: number;
  accuracy: number;
  criticalChance: number;
  criticalDamage: number;
  /** Total cosmetic spread arc in degrees for this weapon (e.g. shotgun 10°, gatling 2°).
   *  Purely visual/trajectory — accuracy is a separate hit/miss roll (see rollDamage below),
   *  not a spread modifier. Data-driven from the Weapons sheet, not hardcoded per weapon. */
  spreadDegrees: number;
  /** px/s — BASE_BULLET_SPEED for every weapon except sniper (x2) and grenade_launcher
   *  (/2), see config/game.ts's bulletSpeedForWeapon(). No weapon sets its own value anymore. */
  bulletSpeed: number;
  /** AoE splash radius in px — only meaningful for "aoe"/"lob" fireMode. */
  explosionRadius: number;
}

interface FireParams {
  scene: Phaser.Scene;
  group: Phaser.Physics.Arcade.Group;
  textureKey: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  stats: FireStats;
  /** true for lob-mode grenades — these ignore cover so they can be lobbed over walls. */
  ignoreCover?: boolean;
  /** Which side fired this shot — needed so the lob-arrival AoE event knows who to damage. */
  isPlayerBullet: boolean;
  /** v34: real path of the equipped bulletSprite (e.g. ".../bullet_round.svg"),
   *  used only to look up that sprite's drawn orientation (see
   *  bulletOrientation.ts) so it visually faces its actual travel direction.
   *  Omitted by Enemy.ts, which fires a plain generated circle with no
   *  drawn "facing" to correct. */
  bulletSpritePath?: string;
  /** v14: called once per actual shot fired (not once per trigger pull) — lets
   *  burst/spread/aoe weapons play their gunshot sfx once per round, timed
   *  with each staggered bullet spawn (e.g. M16A4's 3-round burst → 3 gunshots). */
  onShotFired?: () => void;
}

function rollDamage(stats: FireStats, isHit: boolean): number {
  if (!isHit) return 0;
  const isCrit = Math.random() * 100 < stats.criticalChance;
  return isCrit ? Math.round(stats.damage * (stats.criticalDamage / 100)) : stats.damage;
}

/**
 * Spawns bullets for one trigger-pull according to the weapon's fireMode.
 * Returns the number of magazine/ammo rounds this pull consumes.
 *
 * Accuracy is NEVER used to widen/narrow the visual spread — it's purely a
 * per-shot hit-chance roll (see rollDamage): a bullet can visually connect
 * with an enemy and still register as a "MISS" (0 damage) if the roll fails.
 * Visual spread is controlled entirely by `stats.spreadDegrees`, set per
 * weapon in the Weapons sheet.
 */
export function fireShots(params: FireParams): number {
  const { scene, group, textureKey, x, y, targetX, targetY, stats, ignoreCover, isPlayerBullet, bulletSpritePath, onShotFired } = params;
  const baseAngle = Phaser.Math.Angle.Between(x, y, targetX, targetY);
  const halfArcRad = Phaser.Math.DegToRad(stats.spreadDegrees) / 2;
  const rotationOffset = bulletSpritePath ? bulletRotationOffset(bulletSpritePath) : 0;

  const spawnBullet = (angleOffset: number, isAoe: boolean, isLob: boolean, delayMs: number) => {
    scene.time.delayedCall(delayMs, () => {
      onShotFired?.();
      const bullet = group.get(x, y, textureKey) as Phaser.Physics.Arcade.Image | null;
      if (!bullet) return;
      bullet.setActive(true).setVisible(true);
      (bullet.body as Phaser.Physics.Arcade.Body).enable = true;

      const angle = baseAngle + angleOffset;
      bullet.setVelocity(Math.cos(angle) * stats.bulletSpeed, Math.sin(angle) * stats.bulletSpeed);
      bullet.setRotation(angle + rotationOffset);
      bullet.setDepth(5);

      const isHit = Phaser.Math.FloatBetween(0, 100) < stats.accuracy;
      const damage = rollDamage(stats, isHit);
      bullet.setData("damage", damage);
      bullet.setData("isMiss", !isHit);
      bullet.setData("isAoe", isAoe);
      bullet.setData("explosionRadius", stats.explosionRadius);
      bullet.setData("ignoreCover", !!ignoreCover);
      bullet.setData("isLob", isLob);
      bullet.setData("hasHit", false);

      scene.time.delayedCall(2000, () => { if (bullet.active) bullet.destroy(); });
    });
  };

  switch (stats.fireMode) {
    case "single":
      spawnBullet(Phaser.Math.FloatBetween(-halfArcRad, halfArcRad), false, false, 0);
      return 1;

    case "burst": {
      const count = Math.max(1, stats.projectileCount);
      for (let i = 0; i < count; i++) {
        spawnBullet(Phaser.Math.FloatBetween(-halfArcRad, halfArcRad), false, false, i * 90);
      }
      return count;
    }

    case "spread": {
      const count = Math.max(1, stats.projectileCount);
      for (let i = 0; i < count; i++) {
        spawnBullet(Phaser.Math.FloatBetween(-halfArcRad, halfArcRad), false, false, 0);
      }
      return count;
    }

    case "aoe": {
      // Normally 1 rocket (rocket_launcher's projectileCount), but the boss's
      // synthetic weapon config sets projectileCount higher (5 rockets/volley) —
      // fire them staggered like burst mode.
      const count = Math.max(1, stats.projectileCount);
      for (let i = 0; i < count; i++) {
        spawnBullet(Phaser.Math.FloatBetween(-halfArcRad, halfArcRad), true, false, i * 120);
      }
      return count;
    }

    case "lob": {
      // Grenade Launcher: click-to-target. The grenade always ignores cover (set
      // below regardless of the `ignoreCover` param, and GameScene's process
      // callback skips both physical collision AND the detonate-on-cover-hit
      // callback for it) and detonates by ARRIVAL TIME at the exact clicked
      // point, not by hitting anything — so it reliably "lands" where clicked
      // even after flying straight over walls/trees/houses.
      const dist = Phaser.Math.Distance.Between(x, y, targetX, targetY);
      const travelMs = Math.max(50, (dist / stats.bulletSpeed) * 1000);

      onShotFired?.();
      const bullet = group.get(x, y, textureKey) as Phaser.Physics.Arcade.Image | null;
      if (!bullet) return 1;
      bullet.setActive(true).setVisible(true);
      (bullet.body as Phaser.Physics.Arcade.Body).enable = true;
      bullet.setVelocity(Math.cos(baseAngle) * stats.bulletSpeed, Math.sin(baseAngle) * stats.bulletSpeed);
      bullet.setRotation(baseAngle + rotationOffset);
      bullet.setDepth(5);

      const isHit = Phaser.Math.FloatBetween(0, 100) < stats.accuracy;
      const damage = rollDamage(stats, isHit);
      bullet.setData("damage", damage);
      bullet.setData("isMiss", !isHit);
      bullet.setData("isAoe", true);
      bullet.setData("explosionRadius", stats.explosionRadius);
      bullet.setData("ignoreCover", true);
      bullet.setData("isLob", true);
      bullet.setData("hasHit", false);

      scene.time.delayedCall(travelMs, () => {
        if (!bullet.active || bullet.getData("hasHit")) return; // already detonated early via a direct enemy/player overlap
        bullet.setData("hasHit", true);
        scene.events.emit("lob-detonate", { x: targetX, y: targetY, damage, isPlayerBullet, explosionRadius: stats.explosionRadius });
        bullet.destroy();
      });
      return 1;
    }

    default:
      spawnBullet(0, false, false, 0);
      return 1;
  }
}
