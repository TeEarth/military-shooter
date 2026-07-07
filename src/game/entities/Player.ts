import Phaser from "phaser";
import type { CombatLoadout } from "@/types/loadout";
import { PLAYER_CONFIG, UNIT_DISPLAY_SIZE } from "../../../config/player";
import { bulletSpeedForWeapon } from "../../../config/game";
import { fireShots } from "./WeaponFire";
import { sfx } from "@/lib/sfx";

const HEAVY_AUTO_WEAPONS = new Set(["gatling", "ak47", "rasor_gun"]);
const RIFLE_WEAPONS = new Set(["m16a1", "m16a4"]);
const IMPACT_WEAPONS = new Set(["rocket_launcher", "grenade_launcher"]); // explosion plays on impact, not on fire

function shootSfxForWeapon(weaponId: string): "shoot_pistol" | "shoot_rifle" | "shoot_shotgun" | "shoot_sniper" | "shoot_heavy" | null {
  if (IMPACT_WEAPONS.has(weaponId)) return null;
  if (weaponId === "shotgun") return "shoot_shotgun";
  if (weaponId === "sniper") return "shoot_sniper";
  if (HEAVY_AUTO_WEAPONS.has(weaponId)) return "shoot_heavy";
  if (RIFLE_WEAPONS.has(weaponId)) return "shoot_rifle";
  return "shoot_pistol"; // pistol / double_pistol default
}

export class Player {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Image;
  private bullets: Phaser.Physics.Arcade.Group;
  private loadout: CombatLoadout;

  hp: number;
  maxHp: number;
  shield: number;
  shieldMax: number;
  ammo: number;
  maxAmmo: number;
  isDead = false;
  isReloading = false;
  isInvincible = false;

  private magazine: number;
  private lastFireTime = 0;
  private lastRegenTick = 0;
  private ammoUsed = 0;
  private laserSight!: Phaser.GameObjects.Graphics;
  /** v10 #3: weapon layer shown in the player's hands, swapped per equipped
   *  weaponId — undefined only if that weapon's sprite failed to load. */
  private weaponSprite?: Phaser.GameObjects.Image;
  private reloadStartTime = 0;
  private reloadDurationMs = 0;
  private lastFootstepTime = 0;
  private lastDebugLogTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, bullets: Phaser.Physics.Arcade.Group, loadout: CombatLoadout, failedAssetKeys?: Set<string>) {
    this.scene = scene;
    this.bullets = bullets;
    this.loadout = loadout;

    this.hp = loadout.hpMax;
    this.maxHp = loadout.hpMax;
    this.shield = loadout.shieldMax;
    this.shieldMax = loadout.shieldMax;
    this.ammo = loadout.ammo;
    this.maxAmmo = loadout.ammo;
    this.magazine = loadout.magazineSize;
    this.lastRegenTick = scene.time.now;

    // Both the real SVG and the placeholder are generated/loaded at the exact
    // same UNIT_DISPLAY_SIZE — no runtime scaling, so the physics body radius
    // below always matches the visible sprite exactly, in every case.
    const hasRealSprite = scene.textures.exists("char_sprite") && !failedAssetKeys?.has("char_sprite");
    let key = "char_sprite";
    if (!hasRealSprite) {
      key = `player_${loadout.id}_tex`;
      if (!scene.textures.exists(key)) {
        const half = UNIT_DISPLAY_SIZE / 2;
        const gfx = scene.add.graphics();
        gfx.fillStyle(0x2d5a27, 1);
        gfx.fillCircle(half, half, half);
        gfx.fillStyle(0xf39c12, 1);
        gfx.fillCircle(half, half - 10, 6);
        gfx.generateTexture(key, UNIT_DISPLAY_SIZE, UNIT_DISPLAY_SIZE);
        gfx.destroy();
      }
    }

    this.sprite = scene.physics.add.image(x, y, key);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDepth(10);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(UNIT_DISPLAY_SIZE / 2);

    this.laserSight = scene.add.graphics().setDepth(11);

    // v10 #3: weapon sprite matching the equipped weaponId — pivoted low (0.7
    // down the image, where the grip is drawn) so it rotates from roughly the
    // character's hand rather than its own bounding-box center.
    const weaponKey = `weapon_sprite_${loadout.weaponId}`;
    if (scene.textures.exists(weaponKey) && !failedAssetKeys?.has(weaponKey)) {
      this.weaponSprite = scene.add.image(x, y, weaponKey).setOrigin(0.5, 0.7).setDepth(this.sprite.depth + 1);
    }
  }

  update(
    left: boolean, right: boolean, up: boolean, down: boolean,
    shooting: boolean, reloading: boolean,
    pointer: Phaser.Math.Vector2,
    deltaMs: number,
    covers?: Phaser.Physics.Arcade.StaticGroup
  ) {
    if (this.isDead) {
      this.laserSight.clear();
      this.weaponSprite?.setVisible(false);
      return;
    }

    this.debugLogAzzureIfNeeded();

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const moveSpeedPx = this.loadout.moveSpeed * PLAYER_CONFIG.speedMultiplier;
    let vx = 0, vy = 0;
    if (left) vx -= moveSpeedPx;
    if (right) vx += moveSpeedPx;
    if (up) vy -= moveSpeedPx;
    if (down) vy += moveSpeedPx;

    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
    body.setVelocity(vx, vy);

    if (vx !== 0 || vy !== 0) {
      const now = this.scene.time.now;
      if (now - this.lastFootstepTime >= 350) { // throttled to ~2-3 plays/sec
        this.lastFootstepTime = now;
        sfx.play("footstep");
      }
    }

    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, pointer.x, pointer.y);
    this.sprite.setRotation(angle + Math.PI / 2);

    // Same rotation convention as the character body — the weapon SVG is
    // drawn muzzle-up/grip-down, matching char_sprite's default "facing up" pose.
    if (this.weaponSprite) {
      this.weaponSprite.setPosition(this.sprite.x, this.sprite.y);
      this.weaponSprite.setRotation(angle + Math.PI / 2);
      this.weaponSprite.setVisible(true);
    }

    // v8 #6/#7: once the magazine AND the reserve daily ammo are both empty,
    // there is nothing left to reload from — trying anyway was the "reload
    // spins forever" bug (startReload() would fire every frame, always
    // refilling 0 rounds since `this.ammo` was 0, immediately re-triggering
    // on the next frame). Firing is blocked the same way so an empty
    // magazine can never be "shot" through either.
    if (!this.isOutOfAmmo()) {
      if (reloading && !this.isReloading && this.magazine < this.loadout.magazineSize && this.ammo > 0) {
        this.startReload();
      }

      if (shooting && !this.isReloading && this.magazine > 0) {
        this.shoot(pointer);
      } else if (shooting && this.magazine === 0 && !this.isReloading && this.ammo > 0) {
        this.startReload();
      }
    }

    this.regenerate();
    this.updateLaserSight(angle, covers);
  }

  /** v6 #10 diagnostic — see PLAYER_CONFIG.debugAzzureLogging. Only logs for Azzure,
   *  throttled to ~500ms, and only until the root cause of the "character disappears"
   *  report is confirmed with real evidence. */
  private debugLogAzzureIfNeeded() {
    if (!PLAYER_CONFIG.debugAzzureLogging || this.loadout.id !== "azzure") return;
    const now = this.scene.time.now;
    if (now - this.lastDebugLogTime < 500) return;
    this.lastDebugLogTime = now;

    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const bounds = this.scene.physics.world.bounds;
    const outOfBounds = this.sprite.x < 0 || this.sprite.y < 0 || this.sprite.x > bounds.width || this.sprite.y > bounds.height;

    console.log("[AZZURE-DEBUG]", {
      x: Math.round(this.sprite.x),
      y: Math.round(this.sprite.y),
      visible: this.sprite.visible,
      active: this.sprite.active,
      alpha: this.sprite.alpha,
      depth: this.sprite.depth,
      textureKey: this.sprite.texture?.key,
      bodyEnable: body?.enable,
      bodyExists: !!body,
      outOfBounds,
      worldBounds: { width: bounds.width, height: bounds.height },
    });
  }

  /** Sniper-only: a real-time red aim line from the player to wherever they're
   *  pointing, cut short by the first cover object it crosses. */
  private updateLaserSight(angle: number, covers?: Phaser.Physics.Arcade.StaticGroup) {
    this.laserSight.clear();
    if (this.loadout.weaponId !== "sniper") return;

    const maxRange = 2500;
    const stepSize = 24;
    let endX = this.sprite.x + Math.cos(angle) * maxRange;
    let endY = this.sprite.y + Math.sin(angle) * maxRange;

    if (covers) {
      for (let d = stepSize; d <= maxRange; d += stepSize) {
        const px = this.sprite.x + Math.cos(angle) * d;
        const py = this.sprite.y + Math.sin(angle) * d;
        let blocked = false;
        covers.children.iterate((coverObj) => {
          const img = coverObj as Phaser.Physics.Arcade.Image;
          // Trees are walk-through/shoot-through cover (see GameScene's `notTree`
          // collider filter) — the laser sight must pass through them the same
          // way bullets do, instead of stopping dead at the first tree it crosses.
          if (img.getData("coverType") === "tree") return true;
          if (Phaser.Geom.Rectangle.Contains(img.getBounds(), px, py)) {
            blocked = true;
            return false;
          }
          return true;
        });
        if (blocked) {
          endX = px;
          endY = py;
          break;
        }
      }
    }

    this.laserSight.lineStyle(1.5, 0xff0000, 0.55);
    this.laserSight.lineBetween(this.sprite.x, this.sprite.y, endX, endY);
  }

  /** HP regenerates by a flat amount every fixed tick, independent of recent damage. */
  private regenerate() {
    if (this.hp <= 0 || this.hp >= this.maxHp) return;
    const now = this.scene.time.now;
    if (now - this.lastRegenTick < PLAYER_CONFIG.hpRegenTickMs) return;
    this.lastRegenTick = now;
    this.hp = Math.min(this.maxHp, this.hp + this.loadout.regenPer5s);
  }

  private shoot(target: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    const cooldown = 1000 / this.loadout.fireRate;
    if (now - this.lastFireTime < cooldown) return;
    if (this.magazine <= 0) return;
    this.lastFireTime = now;

    const shootSfx = shootSfxForWeapon(this.loadout.weaponId);

    const key = this.scene.textures.exists("bullet_sprite") ? "bullet_sprite" : "bullet_tex";
    if (!this.scene.textures.exists(key)) {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xf39c12, 1);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture(key, 8, 8);
      gfx.destroy();
    }

    const rounds = fireShots({
      scene: this.scene,
      group: this.bullets,
      textureKey: key,
      x: this.sprite.x,
      y: this.sprite.y,
      targetX: target.x,
      targetY: target.y,
      isPlayerBullet: true,
      ignoreCover: this.loadout.fireMode === "lob",
      // v14: called once per actual round fired (not once per trigger pull),
      // so a 3-round burst weapon like M16A4 plays 3 consecutive gunshots.
      onShotFired: shootSfx ? () => sfx.play(shootSfx) : undefined,
      stats: {
        damage: this.loadout.damage,
        fireMode: this.loadout.fireMode,
        projectileCount: this.loadout.projectileCount,
        accuracy: this.loadout.accuracy,
        criticalChance: this.loadout.criticalChance,
        criticalDamage: this.loadout.criticalDamage,
        spreadDegrees: this.loadout.spreadDegrees,
        bulletSpeed: bulletSpeedForWeapon(this.loadout.weaponId),
        explosionRadius: this.loadout.explosionRadius,
      },
    });

    const consumed = Math.min(rounds, this.magazine, this.ammo);
    this.magazine = Math.max(0, this.magazine - consumed);
    this.ammo = Math.max(0, this.ammo - consumed);
    this.ammoUsed += consumed;
  }

  private startReload() {
    this.isReloading = true;
    sfx.play("reload");
    this.reloadStartTime = this.scene.time.now;
    this.reloadDurationMs = this.loadout.reloadTime * 1000;
    this.scene.time.delayedCall(this.reloadDurationMs, () => {
      const needed = this.loadout.magazineSize - this.magazine;
      const filled = Math.min(needed, this.ammo);
      this.magazine += filled;
      this.isReloading = false;
    });
  }

  /** 0-1 reload progress, or -1 if not currently reloading — drives the HUD's reload bar. */
  getReloadProgress(): number {
    if (!this.isReloading || this.reloadDurationMs <= 0) return -1;
    return Phaser.Math.Clamp((this.scene.time.now - this.reloadStartTime) / this.reloadDurationMs, 0, 1);
  }

  getMagazine() { return this.magazine; }
  getMagazineSize() { return this.loadout.magazineSize; }
  getAmmoUsed() { return this.ammoUsed; }
  isOutOfAmmo() { return this.magazine <= 0 && this.ammo <= 0; }

  /** Armor is a flat percentage damage reduction, not a separate buffer. Shield
   *  (from equipped gear) absorbs damage before HP and never regenerates mid-stage. */
  takeDamage(amount: number) {
    if (this.isInvincible || this.isDead) return;
    const effective = amount * (1 - this.loadout.armorPercent / 100);
    this.applyToShieldThenHp(effective);
    this.setInvincible();
    if (this.hp <= 0) this.die();
  }

  /** AoE splash from a rocket/grenade explosion — no armor mitigation, always full damage (still shield-first). */
  takeAoeDamage(amount: number) {
    if (this.isDead) return;
    this.applyToShieldThenHp(amount);
    if (this.hp <= 0) this.die();
  }

  private applyToShieldThenHp(amount: number) {
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, amount);
      this.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) this.hp = Math.max(0, this.hp - amount);
  }

  private setInvincible() {
    this.isInvincible = true;
    this.scene.tweens.add({ targets: this.sprite, alpha: 0.4, duration: 100, yoyo: true, repeat: 3 });
    this.scene.time.delayedCall(PLAYER_CONFIG.invincibleFrames * 1000, () => { this.isInvincible = false; });
  }

  private die() {
    this.isDead = true;
    this.sprite.setAlpha(0.3);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }

  /** Ticket-funded mid-run revive (see GameScene's reviveUsedThisGame gate) —
   *  comes back at half max HP, full shield, and a fresh invincibility window
   *  so the player isn't shot dead again the instant they reappear. */
  revive() {
    this.isDead = false;
    this.hp = Math.ceil(this.maxHp * 0.5);
    this.shield = this.shieldMax;
    this.sprite.setAlpha(1);
    this.setInvincible();
  }
}
