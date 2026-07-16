import Phaser from "phaser";
import type { EnemySpawn } from "@/types/enemy";
import { ENEMY_CONFIG } from "../../../config/enemy";
import { fireShots } from "./WeaponFire";
import { UNIT_DISPLAY_SIZE } from "../../../config/player";
import { bulletSpeedForWeapon } from "../../../config/game";

type AIState = "patrol" | "chase" | "shoot" | "approach";

/**
 * Enemy behavior is entirely driven by the Weapon it's carrying (data.weapon) —
 * damage/fireRate/fireMode/accuracy/magazine/reload all come from the Weapons
 * sheet, exactly like the player. Adding a new enemy type is just a new row in
 * the Enemies sheet referencing any weaponId — no code change needed here.
 */
export class Enemy {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Image;
  private weaponSprite?: Phaser.GameObjects.Image;
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
    // preferredRange: how close the enemy tries to get before it stops
    // advancing and just shoots in place. v15 capped this well under the old
    // lineOfSightRange (350) so high-accuracy weapons (sniper 80, rocket
    // launcher 100) wouldn't always be "close enough" the instant they had
    // line of sight — v16 removed lineOfSightRange entirely (enemies can now
    // shoot at any range), but the cap is kept for the same reason: without
    // it, high-accuracy enemies would never bother closing the distance at all.
    this.preferredRange = Math.min(200, 60 + this.data.weapon.accuracy * 1.5);
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

    // v31 fix: previously every enemy showed the same generic gun shape
    // baked into its body art, so a shotgunner and a sniper looked
    // identical — this shows the REAL weapon it's carrying, same
    // `weapon_sprite_${weaponId}` asset/key the player itself uses (see
    // PreloadScene, which loads one per distinct enemy weaponId in the roster).
    const weaponKey = `weapon_sprite_${this.data.weaponId}`;
    if (scene.textures.exists(weaponKey) && !failedAssetKeys?.has(weaponKey)) {
      this.weaponSprite = scene.add.image(x, y, weaponKey).setOrigin(0.5, 0.7).setDepth(this.sprite.depth + 1);
    }

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

  update(playerX: number, playerY: number, playerHidden = false) {
    if (this.isDead) return;

    // v14: tree stealth — a hidden player is invisible to enemy AI entirely,
    // regardless of distance. Falls back to whatever the enemy was doing
    // before (patrol/wander), same as never having spotted the player at all.
    // A stationary turret (v16) has no patrol either — it just goes idle.
    if (playerHidden) {
      this.state = "patrol";
      if (this.data.immobile) (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      else this.patrol();
      const margin = UNIT_DISPLAY_SIZE / 2;
      this.sprite.x = Phaser.Math.Clamp(this.sprite.x, margin, this.worldWidth - margin);
      this.sprite.y = Phaser.Math.Clamp(this.sprite.y, margin, this.worldHeight - margin);
      this.syncWeaponSprite();
      this.updateHpBar();
      return;
    }

    // v18: three concentric bands (four for immobile turrets, which never
    // chase/approach at all):
    //  - dist <= preferredRange: comfortable range, stand still and unload.
    //  - preferredRange < dist <= detectionRange: spotted and closing in fast
    //    (full chaseSpeed), no shooting yet.
    //  - detectionRange < dist <= shootRange (300-450px): still shoots from
    //    here, but no longer frozen in place — creeps closer at a slower,
    //    deliberate approachSpeed while firing, instead of standing rooted.
    //  - dist > shootRange: out of range entirely, just patrols.
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, playerX, playerY);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;

    if (this.data.immobile) {
      this.state = dist <= ENEMY_CONFIG.shootRange ? "shoot" : "patrol";
    } else if (dist <= this.preferredRange) {
      this.state = "shoot";
    } else if (dist <= ENEMY_CONFIG.detectionRange) {
      this.state = "chase";
    } else if (dist <= ENEMY_CONFIG.shootRange) {
      this.state = "approach";
    } else {
      this.state = "patrol";
    }

    switch (this.state) {
      case "chase":
        this.moveToward(playerX, playerY, ENEMY_CONFIG.chaseSpeed);
        break;
      case "shoot": {
        body.setVelocity(0, 0);
        // v31 fix: standing still to shoot never updated facing before, so a
        // stationary enemy (or a turret) kept whatever rotation it last had
        // from movement — now it visibly turns to face the player it's firing at.
        const aimAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, playerX, playerY);
        this.sprite.setRotation(aimAngle + Math.PI / 2);
        this.tryShoot(playerX, playerY);
        break;
      }
      case "approach":
        this.moveToward(playerX, playerY, ENEMY_CONFIG.approachSpeed);
        this.tryShoot(playerX, playerY);
        break;
      case "patrol":
        // A turret-style immobile enemy never patrols — out of shoot range just
        // means it stands idle, not that it starts walking around.
        if (this.data.immobile) body.setVelocity(0, 0);
        else this.patrol();
        break;
    }

    // Defense-in-depth on top of setCollideWorldBounds(true) — clamp the visible
    // position every frame so an enemy can never render outside the stage.
    const margin = UNIT_DISPLAY_SIZE / 2;
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, margin, this.worldWidth - margin);
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, margin, this.worldHeight - margin);

    this.syncWeaponSprite();
    this.updateHpBar();
  }

  /** Keeps the weapon overlay glued to the body's current position/rotation
   *  every frame — same convention as Player.ts's own weaponSprite. */
  private syncWeaponSprite() {
    if (!this.weaponSprite) return;
    this.weaponSprite.setPosition(this.sprite.x, this.sprite.y);
    this.weaponSprite.setRotation(this.sprite.rotation);
    this.weaponSprite.setVisible(true);
  }

  private moveToward(tx: number, ty: number, speed: number) {
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, tx, ty);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.sprite.setRotation(angle + Math.PI / 2);
  }

  private patrol() {
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, this.patrolTarget.x, this.patrolTarget.y);
    if (dist < 10) this.pickNewPatrolTarget();
    this.moveToward(this.patrolTarget.x, this.patrolTarget.y, ENEMY_CONFIG.patrolSpeed);
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
    if (this.weaponSprite) {
      const weaponSprite = this.weaponSprite;
      this.scene.tweens.add({ targets: weaponSprite, alpha: 0, duration: 800, onComplete: () => weaponSprite.destroy() });
    }
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
  getHp() { return this.hp; }
  getMaxHp() { return this.maxHp; }
}
