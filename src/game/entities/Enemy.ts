import Phaser from "phaser";
import type { EnemySpawn } from "@/types/enemy";
import { ENEMY_CONFIG } from "../../../config/enemy";
import { fireShots } from "./WeaponFire";
import { UNIT_DISPLAY_SIZE } from "../../../config/player";
import { bulletSpeedForWeapon } from "../../../config/game";

type AIState = "patrol" | "chase" | "shoot";

/**
 * Enemy behavior is entirely driven by the Weapon it's carrying (data.weapon) —
 * damage/fireRate/fireMode/accuracy/magazine/reload all come from the Weapons
 * sheet, exactly like the player. Adding a new enemy type is just a new row in
 * the Enemies sheet referencing any weaponId — no code change needed here.
 */
export class Enemy {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Image;
  private enemyBullets: Phaser.Physics.Arcade.Group;
  data: EnemySpawn;

  isDead = false;
  private hp: number;
  private maxHp: number;

  private state: AIState = "patrol";
  private magazine: number;
  private isReloading = false;
  private lastFireTime = 0;
  private patrolTarget: Phaser.Math.Vector2;
  private hpBar!: Phaser.GameObjects.Graphics;
  private preferredRange: number;
  private worldWidth: number;
  private worldHeight: number;

  constructor(scene: Phaser.Scene, x: number, y: number, data: EnemySpawn, enemyBullets: Phaser.Physics.Arcade.Group, group: Phaser.Physics.Arcade.Group, hpMultiplier: number, damageMultiplier: number, failedAssetKeys?: Set<string>) {
    this.scene = scene;
    this.data = { ...data, hp: Math.round(data.hp * hpMultiplier), weapon: { ...data.weapon, damage: Math.round(data.weapon.damage * damageMultiplier) } };

    this.enemyBullets = enemyBullets;
    this.hp = this.data.hp;
    this.maxHp = this.data.hp;
    this.magazine = this.data.weapon.magazineSize;
    this.preferredRange = 100 + this.data.weapon.accuracy * 3;
    this.worldWidth = scene.physics.world.bounds.width;
    this.worldHeight = scene.physics.world.bounds.height;

    // Loaded at the exact same UNIT_DISPLAY_SIZE as the player (see PreloadScene.ts) —
    // no runtime up/downscaling, so the body radius below always matches the
    // visible sprite exactly, whether it's the real art or the placeholder.
    const realKey = `enemy_sprite_${data.id}`;
    const hasRealSprite = scene.textures.exists(realKey) && !failedAssetKeys?.has(realKey);

    let key = realKey;
    if (!hasRealSprite) {
      key = `enemy_${data.id}_tex`;
      if (!scene.textures.exists(key)) {
        const half = UNIT_DISPLAY_SIZE / 2;
        const gfx = scene.add.graphics();
        gfx.fillStyle(0x885522, 1);
        gfx.fillCircle(half, half, half);
        gfx.generateTexture(key, UNIT_DISPLAY_SIZE, UNIT_DISPLAY_SIZE);
        gfx.destroy();
      }
    }

    this.sprite = scene.physics.add.image(x, y, key);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(UNIT_DISPLAY_SIZE / 2);
    this.sprite.setDepth(9);
    this.sprite.setCollideWorldBounds(true);
    group.add(this.sprite);

    this.patrolTarget = new Phaser.Math.Vector2(x, y);
    this.pickNewPatrolTarget();

    this.hpBar = scene.add.graphics();
    this.updateHpBar();
  }

  /** Always within the stage's actual bounds — a patrol target generated off-map
   *  (e.g. near an edge, offset outward) was letting enemies drift against the
   *  world-bounds wall indefinitely trying to reach an unreachable point. */
  private pickNewPatrolTarget() {
    const margin = UNIT_DISPLAY_SIZE;
    const x = Phaser.Math.Clamp(this.sprite.x + Phaser.Math.Between(-150, 150), margin, this.worldWidth - margin);
    const y = Phaser.Math.Clamp(this.sprite.y + Phaser.Math.Between(-150, 150), margin, this.worldHeight - margin);
    this.patrolTarget.set(x, y);
  }

  update(playerX: number, playerY: number) {
    if (this.isDead) return;

    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    const hasLOS = dist < ENEMY_CONFIG.lineOfSightRange;

    if (hasLOS) {
      this.state = dist < this.preferredRange ? "shoot" : "chase";
    } else if (dist < ENEMY_CONFIG.detectionRange) {
      this.state = "chase";
    } else {
      this.state = "patrol";
    }

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    switch (this.state) {
      case "chase":
        this.moveToward(playerX, playerY);
        break;
      case "shoot":
        body.setVelocity(0, 0);
        this.tryShoot(playerX, playerY);
        break;
      case "patrol":
        this.patrol();
        break;
    }

    // Defense-in-depth on top of setCollideWorldBounds(true) — clamp the visible
    // position every frame so an enemy can never render outside the stage.
    const margin = UNIT_DISPLAY_SIZE / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, margin, this.worldWidth - margin);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, margin, this.worldHeight - margin);

    this.updateHpBar();
  }

  private moveToward(tx: number, ty: number) {
    const speed = 80;
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, tx, ty);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.sprite.setRotation(angle + Math.PI / 2);
  }

  private patrol() {
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.patrolTarget.x, this.patrolTarget.y);
    if (dist < 10) this.pickNewPatrolTarget();
    this.moveToward(this.patrolTarget.x, this.patrolTarget.y);
  }

  private tryShoot(targetX: number, targetY: number) {
    if (this.isReloading) return;
    if (this.magazine <= 0) {
      this.startReload();
      return;
    }

    const weapon = this.data.weapon;
    const now = this.scene.time.now;
    const cooldown = 1000 / weapon.fireRate;
    if (now - this.lastFireTime < cooldown) return;
    this.lastFireTime = now;

    const key = `enemy_bullet_tex`;
    if (!this.scene.textures.exists(key)) {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xff4444, 1);
      gfx.fillCircle(3, 3, 3);
      gfx.generateTexture(key, 6, 6);
      gfx.destroy();
    }

    const rounds = fireShots({
      scene: this.scene,
      group: this.enemyBullets,
      textureKey: key,
      x: this.sprite.x,
      y: this.sprite.y,
      targetX,
      targetY,
      isPlayerBullet: false,
      ignoreCover: weapon.fireMode === "lob",
      stats: {
        damage: weapon.damage,
        fireMode: weapon.fireMode,
        projectileCount: weapon.projectileCount,
        accuracy: weapon.accuracy,
        criticalChance: weapon.critChance,
        criticalDamage: weapon.critDamage,
        spreadDegrees: weapon.spreadDegrees,
        bulletSpeed: bulletSpeedForWeapon(weapon.id),
        explosionRadius: weapon.explosionRadius,
      },
    });

    this.magazine = Math.max(0, this.magazine - rounds);
  }

  private startReload() {
    this.isReloading = true;
    this.scene.time.delayedCall(this.data.weapon.reloadTime * 1000, () => {
      this.magazine = this.data.weapon.magazineSize;
      this.isReloading = false;
    });
  }

  /** Applies damage; returns true if this hit killed the enemy. */
  takeDamage(amount: number): boolean {
    this.hp = Math.max(0, this.hp - amount);
    this.updateHpBar();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    this.scene.tweens.add({ targets: this.sprite, tint: 0xff0000, duration: 80, yoyo: true });
    return false;
  }

  private die() {
    this.isDead = true;
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.sprite.setAlpha(0.3);
    this.hpBar.destroy();
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, duration: 800, onComplete: () => this.sprite.destroy() });
  }

  private updateHpBar() {
    if (this.isDead) return;
    this.hpBar.clear();
    const x = this.sprite.x - 16;
    const y = this.sprite.y - 34;
    this.hpBar.fillStyle(0x440000, 1);
    this.hpBar.fillRect(x, y, 32, 4);
    this.hpBar.fillStyle(0x00cc00, 1);
    this.hpBar.fillRect(x, y, 32 * (this.hp / this.maxHp), 4);
  }

  getCoinReward() { return this.data.coinReward; }
}
