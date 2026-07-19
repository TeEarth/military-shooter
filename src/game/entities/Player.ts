import Phaser from "phaser";
import type { CombatLoadout } from "@/types/loadout";
import { PLAYER_CONFIG, UNIT_DISPLAY_SIZE } from "../../../config/player";
import { bulletSpeedForWeapon } from "../../../config/game";
import { fireShots } from "./WeaponFire";
import { sfx } from "@/lib/sfx";
import { RECOIL_KICK_PX, decayRecoil, spawnMuzzleEffect, reloadWiggle } from "./WeaponFx";

// v36: all 4 share ONE recorded clip (see sfx.ts's shoot_rifle sample) —
// rasor_gun split out to its own dedicated recording (shoot_rasor).
const RIFLE_WEAPONS = new Set(["gatling", "ak47", "m16a1", "m16a4"]);

function shootSfxForWeapon(weaponId: string): "shoot_pistol" | "shoot_rifle" | "shoot_shotgun" | "shoot_sniper" | "shoot_rasor" | "shoot_rocket" | null {
  // v37: grenade_launcher shares rocket_launcher's fire sound (no separate one provided).
  if (weaponId === "grenade_launcher" || weaponId === "rocket_launcher") return "shoot_rocket";
  if (weaponId === "shotgun") return "shoot_shotgun";
  if (weaponId === "sniper") return "shoot_sniper";
  if (weaponId === "rasor_gun") return "shoot_rasor";
  if (RIFLE_WEAPONS.has(weaponId)) return "shoot_rifle";
  return "shoot_pistol"; // pistol / double_pistol default
}

/** v35: which perks a player has purchased — see src/lib/perks.ts for the
 *  catalog/descriptions. Gameplay behavior for all 4 lives entirely in this
 *  file; cooldowns are in-memory per-session (never persisted), only
 *  ownership itself is a DB flag. */
export interface PlayerPerks {
  spareWeapon: boolean;
  regen: boolean;
  superShield: boolean;
  oneShot: boolean;
  /** v50: automatic, looping stealth — see maybeTriggerInvisiblePerk. Unlike
   *  tree stealth (GameScene's isHidden), the player can move/shoot while it's
   *  active; GameScene ORs isInvisibleActive() into its own enemy-detection
   *  check instead of replacing it. */
  invisible: boolean;
  /** v50: once-per-match "can't actually die" — see applyToShieldThenHp. */
  neverDied: boolean;
}

const REGEN_HP_THRESHOLD = 0.2;
const REGEN_COOLDOWN_MS = 30_000;
const SHIELD_EMPTY_TRIGGER_MS = 15_000;
const SHIELD_COOLDOWN_MS = 60_000;
const SHIELD_REFILL_FRACTION = 0.5;
const ONE_SHOT_COOLDOWN_MS = 30_000;
const ONE_SHOT_DAMAGE = 3000;
const ONE_SHOT_AOE_DAMAGE = 1000;
const ONE_SHOT_AOE_RADIUS_MULTIPLIER = 3;
const SWAP_COOLDOWN_MS = 5_000;
const INVISIBLE_DURATION_MS = 3_000;
const INVISIBLE_COOLDOWN_MS = 7_000;
const NEVER_DIED_INVINCIBLE_MS = 3_000;

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
  private failedAssetKeys?: Set<string>;
  private reloadStartTime = 0;
  private reloadDurationMs = 0;
  /** v37: handle for the currently-looping reload sound, or null when not reloading. */
  private reloadLoopHandle: { stop: () => void } | null = null;
  /** v34: current backward "kick" offset (px) applied to the weapon sprite
   *  only — decays back to 0 every frame, see WeaponFx.ts. */
  private recoilAmount = 0;
  private lastFootstepTime = 0;
  private lastDebugLogTime = 0;

  // v35: Spare Weapon perk — this.loadout/this.magazine/this.ammo/this.maxAmmo
  // /this.ammoUsed always describe whichever weapon is currently ACTIVE;
  // swapWeapon() saves the outgoing weapon's state into these "off" slots and
  // restores the incoming one's, so shoot()/reload()/update() never need to
  // know a swap even happened.
  perks: PlayerPerks;
  private mainLoadout: CombatLoadout;
  private spareLoadout: CombatLoadout | null;
  private usingSpare = false;
  private offMagazine = 0;
  private offAmmo = 0;
  private offMaxAmmo = 0;
  private offAmmoUsed = 0;
  private lastSwapTime = -Infinity;

  // v35: Regeneration / Super Shield perks — auto-triggered in update(), see
  // maybeTriggerRegen/maybeTriggerShield below.
  private regenCooldownUntil = -Infinity;
  private shieldEmptySince: number | null = null;
  private shieldCooldownUntil = -Infinity;

  // v35: One Shot perk — armed by the HUD button (see armOneShot), consumed
  // by the very next shoot() call regardless of how long after arming.
  private oneShotArmed = false;
  private oneShotCooldownUntil = -Infinity;

  // v50: Invisible perk — auto-loops the whole match, starting the instant it
  // can (cooldownUntil starts at 0, not -Infinity, so it fires almost
  // immediately on spawn rather than waiting out a full cooldown first).
  private invisibleUntil = -Infinity;
  private invisibleCooldownUntil = 0;

  // v50: Never Died perk — one-time use per match; a dedicated invincibility
  // window separate from the normal 0.3s post-hit i-frames (setInvincible()),
  // since that timer would otherwise immediately overwrite/cut this one short.
  private neverDiedUsed = false;
  private neverDiedInvincibleUntil = -Infinity;

  constructor(
    scene: Phaser.Scene, x: number, y: number, bullets: Phaser.Physics.Arcade.Group, loadout: CombatLoadout,
    failedAssetKeys?: Set<string>,
    spareLoadout: CombatLoadout | null = null,
    perks: PlayerPerks = { spareWeapon: false, regen: false, superShield: false, oneShot: false, invisible: false, neverDied: false }
  ) {
    this.scene = scene;
    this.bullets = bullets;
    this.loadout = loadout;
    this.mainLoadout = loadout;
    this.spareLoadout = perks.spareWeapon ? spareLoadout : null;
    this.perks = perks;

    this.hp = loadout.hpMax;
    this.maxHp = loadout.hpMax;
    this.shield = loadout.shieldMax;
    this.shieldMax = loadout.shieldMax;
    this.ammo = loadout.ammo;
    this.maxAmmo = loadout.ammo;
    this.magazine = loadout.magazineSize;
    if (this.spareLoadout) {
      this.offMagazine = this.spareLoadout.magazineSize;
      this.offAmmo = this.spareLoadout.ammo;
      this.offMaxAmmo = this.spareLoadout.ammo;
    }
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

    this.failedAssetKeys = failedAssetKeys;
    this.syncWeaponSpriteTexture();
  }

  /** v10 #3 / v35: (re)creates the weapon overlay for whichever loadout is
   *  currently active — pivoted low (0.7 down the image, where the grip is
   *  drawn) so it rotates from roughly the character's hand rather than its
   *  own bounding-box center. Called at construction and again on every
   *  swapWeapon() so the on-screen gun always matches the active weapon. */
  private syncWeaponSpriteTexture() {
    this.weaponSprite?.destroy();
    this.weaponSprite = undefined;
    const weaponKey = `weapon_sprite_${this.loadout.weaponId}`;
    if (this.scene.textures.exists(weaponKey) && !this.failedAssetKeys?.has(weaponKey)) {
      this.weaponSprite = this.scene.add.image(this.sprite.x, this.sprite.y, weaponKey).setOrigin(0.5, 0.7).setDepth(this.sprite.depth + 1);
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
    this.recoilAmount = decayRecoil(this.recoilAmount, deltaMs);
    if (this.weaponSprite) {
      // v34: recoil kicks the weapon straight back opposite the aim direction;
      // reloading adds a small wiggle on top so it visibly moves the whole
      // time a mag is being worked, not just at the start/end.
      let dx = -Math.cos(angle) * this.recoilAmount;
      let dy = -Math.sin(angle) * this.recoilAmount;
      let extraRotation = 0;
      if (this.isReloading) {
        const w = reloadWiggle(this.scene.time.now - this.reloadStartTime);
        dx += w.dx;
        dy += w.dy;
        extraRotation = w.dRotation;
      }
      this.weaponSprite.setPosition(this.sprite.x + dx, this.sprite.y + dy);
      this.weaponSprite.setRotation(angle + Math.PI / 2 + extraRotation);
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
    this.maybeTriggerRegenPerk();
    this.maybeTriggerShieldPerk();
    this.maybeTriggerInvisiblePerk();
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

  /** v35: Regeneration perk — auto full-heal the instant HP drops below 20%,
   *  30s cooldown before it can fire again. */
  private maybeTriggerRegenPerk() {
    if (!this.perks.regen || this.isDead) return;
    const now = this.scene.time.now;
    if (now < this.regenCooldownUntil) return;
    if (this.hp / this.maxHp >= REGEN_HP_THRESHOLD) return;
    this.hp = this.maxHp;
    this.regenCooldownUntil = now + REGEN_COOLDOWN_MS;
    sfx.play("pickup_item");
    this.scene.tweens.add({ targets: this.sprite, tint: 0x4ade80, duration: 200, yoyo: true, onComplete: () => this.sprite.clearTint() });
  }

  /** v35: Super Shield perk — auto-refill to 50% of max shield once shield
   *  has stayed at exactly 0 for 15 continuous seconds; 60s cooldown before
   *  it can fire again. Resets its own timer the moment shield leaves 0
   *  (regardless of why), since the perk is specifically about a *sustained*
   *  empty shield, not a momentary dip. */
  private maybeTriggerShieldPerk() {
    if (!this.perks.superShield || this.isDead || this.shieldMax <= 0) return;
    const now = this.scene.time.now;
    if (this.shield > 0) {
      this.shieldEmptySince = null;
      return;
    }
    if (this.shieldEmptySince === null) {
      this.shieldEmptySince = now;
      return;
    }
    if (now < this.shieldCooldownUntil) return;
    if (now - this.shieldEmptySince < SHIELD_EMPTY_TRIGGER_MS) return;

    this.shield = Math.round(this.shieldMax * SHIELD_REFILL_FRACTION);
    this.shieldCooldownUntil = now + SHIELD_COOLDOWN_MS;
    this.shieldEmptySince = null;
    sfx.play("pickup_item");
    this.scene.tweens.add({ targets: this.sprite, tint: 0x60a5fa, duration: 200, yoyo: true, onComplete: () => this.sprite.clearTint() });
  }

  /** v50: Invisible perk — fully automatic, no button. Fires the instant its
   *  cooldown clears (regardless of what the player is doing), stays active
   *  for INVISIBLE_DURATION_MS, then starts a fresh INVISIBLE_COOLDOWN_MS
   *  before it can fire again — repeats for the whole match on its own.
   *  v61: the sprite's alpha fade (GameScene.ts) was too subtle to notice at
   *  a glance, so this also adds a pulsing purple glow ring for the full
   *  active window — same visual pattern as the Never Died save's gold glow. */
  private maybeTriggerInvisiblePerk() {
    if (!this.perks.invisible || this.isDead) return;
    const now = this.scene.time.now;
    if (now < this.invisibleUntil) return; // already active
    if (now < this.invisibleCooldownUntil) return;
    this.invisibleUntil = now + INVISIBLE_DURATION_MS;
    this.invisibleCooldownUntil = this.invisibleUntil + INVISIBLE_COOLDOWN_MS;

    const glow = this.scene.add.circle(this.sprite.x, this.sprite.y, UNIT_DISPLAY_SIZE * 0.65, 0xa855f7, 0.3).setDepth(this.sprite.depth - 1);
    const glowTween = this.scene.tweens.add({ targets: glow, alpha: 0.55, scale: 1.3, duration: 300, yoyo: true, repeat: -1 });
    const followGlow = () => glow.setPosition(this.sprite.x, this.sprite.y);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, followGlow);
    this.scene.time.delayedCall(INVISIBLE_DURATION_MS, () => {
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, followGlow);
      glowTween.stop();
      glow.destroy();
    });
  }

  /** v50: true while the Invisible perk's window is active — GameScene ORs
   *  this into its own tree-stealth isHidden check for enemy detection, and
   *  into the player alpha fade, without touching either mechanic itself. */
  isInvisibleActive(): boolean {
    return this.scene.time.now < this.invisibleUntil;
  }

  /** v50: seconds until Invisible can trigger again, or -1 if it's owned but
   *  not on a cooldown countdown (either currently active, or the perk isn't
   *  owned at all) — drives the HUD's status icon. */
  getInvisibleCooldownRemaining(): number {
    if (!this.perks.invisible) return -1;
    return Math.max(0, this.invisibleCooldownUntil - this.scene.time.now) / 1000;
  }

  /** v50: whether the once-per-match Never Died save has already been spent. */
  hasUsedNeverDied(): boolean {
    return this.neverDiedUsed;
  }

  /** v35: seconds until Regeneration can trigger again, or -1 if it's ready
   *  (or the perk isn't owned) — drives the HUD's status icon. */
  getRegenCooldownRemaining(): number {
    if (!this.perks.regen) return -1;
    return Math.max(0, this.regenCooldownUntil - this.scene.time.now) / 1000;
  }

  /** v35: same as getRegenCooldownRemaining but for Super Shield — this is
   *  specifically the POST-trigger 60s cooldown, 0 throughout the 15s
   *  empty-shield wait (see getShieldChargeRemaining for that). */
  getShieldCooldownRemaining(): number {
    if (!this.perks.superShield) return -1;
    return Math.max(0, this.shieldCooldownUntil - this.scene.time.now) / 1000;
  }

  /** v36: seconds left until Super Shield WOULD trigger (counting down from
   *  15s once shield hits 0), or -1 if not currently counting down (shield
   *  isn't empty, perk not owned, or it's on its post-trigger cooldown
   *  instead — those are mutually exclusive states the HUD shows differently). */
  getShieldChargeRemaining(): number {
    if (!this.perks.superShield || this.shieldEmptySince === null) return -1;
    if (this.scene.time.now < this.shieldCooldownUntil) return -1;
    const remaining = SHIELD_EMPTY_TRIGGER_MS - (this.scene.time.now - this.shieldEmptySince);
    return remaining > 0 ? remaining / 1000 : -1;
  }

  /** v35: One Shot perk — called by the HUD's skull button. Arms the very
   *  next shot fired (regardless of delay) to deal ONE_SHOT_DAMAGE, or the
   *  smaller ONE_SHOT_AOE_DAMAGE spread over a wider radius for AoE weapons.
   *  Cooldown starts on the button press itself, not on the shot landing. */
  armOneShot(): boolean {
    if (!this.perks.oneShot || this.isDead) return false;
    const now = this.scene.time.now;
    if (now < this.oneShotCooldownUntil) return false;
    this.oneShotArmed = true;
    this.oneShotCooldownUntil = now + ONE_SHOT_COOLDOWN_MS;
    sfx.play("ui_click");
    return true;
  }

  getOneShotCooldownRemaining(): number {
    if (!this.perks.oneShot) return -1;
    return Math.max(0, this.oneShotCooldownUntil - this.scene.time.now) / 1000;
  }

  isOneShotArmed(): boolean {
    return this.oneShotArmed;
  }

  /** v35: Spare Weapon perk — swaps the active loadout with the spare,
   *  carrying over each weapon's own magazine/ammo state so nothing resets
   *  just from switching (and switching back). No-op if the perk/spare isn't
   *  set up, mid-reload (swapping away shouldn't cancel/hide an in-progress
   *  reload silently), or still on cooldown. Returns whether it actually swapped. */
  swapWeapon(): boolean {
    if (!this.spareLoadout || this.isDead || this.isReloading) return false;
    const now = this.scene.time.now;
    if (now - this.lastSwapTime < SWAP_COOLDOWN_MS) return false;

    const outgoingMagazine = this.magazine;
    const outgoingAmmo = this.ammo;
    const outgoingMaxAmmo = this.maxAmmo;
    const outgoingAmmoUsed = this.ammoUsed;

    this.loadout = this.usingSpare ? this.mainLoadout : this.spareLoadout;
    this.magazine = this.offMagazine;
    this.ammo = this.offAmmo;
    this.maxAmmo = this.offMaxAmmo;
    this.ammoUsed = this.offAmmoUsed;

    this.offMagazine = outgoingMagazine;
    this.offAmmo = outgoingAmmo;
    this.offMaxAmmo = outgoingMaxAmmo;
    this.offAmmoUsed = outgoingAmmoUsed;

    this.usingSpare = !this.usingSpare;
    this.lastSwapTime = now;
    this.syncWeaponSpriteTexture();
    sfx.play("reload");
    return true;
  }

  /** v35: seconds until the next swap is allowed, or -1 if the perk/spare
   *  weapon isn't set up at all. */
  getSwapCooldownRemaining(): number {
    if (!this.spareLoadout) return -1;
    return Math.max(0, SWAP_COOLDOWN_MS - (this.scene.time.now - this.lastSwapTime)) / 1000;
  }

  private shoot(target: Phaser.Math.Vector2) {
    const now = this.scene.time.now;
    const cooldown = 1000 / this.loadout.fireRate;
    if (now - this.lastFireTime < cooldown) return;
    if (this.magazine <= 0) return;
    this.lastFireTime = now;

    const shootSfx = shootSfxForWeapon(this.loadout.weaponId);

    // v35: Spare Weapon perk — the active loadout can be either main or
    // spare, each preloaded under its own fixed bullet texture key (see
    // PreloadScene.ts) since Phaser can't swap an already-loaded texture's
    // source mid-scene.
    const preferredKey = this.usingSpare ? "bullet_sprite_spare" : "bullet_sprite";
    const key = this.scene.textures.exists(preferredKey) ? preferredKey : "bullet_tex";
    if (!this.scene.textures.exists(key)) {
      const gfx = this.scene.add.graphics();
      gfx.fillStyle(0xf39c12, 1);
      gfx.fillCircle(4, 4, 4);
      gfx.generateTexture(key, 8, 8);
      gfx.destroy();
    }

    // v35: One Shot perk — consumed here regardless of fireMode; AoE weapons
    // (rocket/grenade) get a much wider but weaker blast instead of the flat
    // per-target damage, per the perk's own description.
    const isAoeWeapon = this.loadout.fireMode === "aoe" || this.loadout.fireMode === "lob";
    const oneShotThisVolley = this.oneShotArmed;
    if (oneShotThisVolley) this.oneShotArmed = false;
    const damage = oneShotThisVolley ? (isAoeWeapon ? ONE_SHOT_AOE_DAMAGE : ONE_SHOT_DAMAGE) : this.loadout.damage;
    const explosionRadius = oneShotThisVolley && isAoeWeapon ? this.loadout.explosionRadius * ONE_SHOT_AOE_RADIUS_MULTIPLIER : this.loadout.explosionRadius;

    const rounds = fireShots({
      scene: this.scene,
      group: this.bullets,
      textureKey: key,
      x: this.sprite.x,
      y: this.sprite.y,
      targetX: target.x,
      targetY: target.y,
      isPlayerBullet: true,
      bulletSpritePath: this.loadout.bulletSprite,
      ignoreCover: this.loadout.fireMode === "lob",
      // v14: called once per actual round fired (not once per trigger pull),
      // so a 3-round burst weapon like M16A4 plays 3 consecutive gunshots.
      // v34: also kicks the weapon sprite back and spawns this weapon's
      // muzzle effect (shell/smoke/flash) on every one of those rounds.
      onShotFired: () => {
        if (shootSfx) sfx.play(shootSfx);
        this.recoilAmount = RECOIL_KICK_PX;
        const fireAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, target.x, target.y);
        spawnMuzzleEffect(this.scene, this.sprite.x, this.sprite.y, fireAngle, this.loadout.bulletSprite);
        this.scene.events.emit("player-fired"); // v39: tutorial's SHOOT step listens for this
      },
      stats: {
        damage,
        fireMode: this.loadout.fireMode,
        projectileCount: this.loadout.projectileCount,
        // v35: One Shot is a guaranteed flat hit, not subject to the normal
        // accuracy/crit RNG on top of an already-fixed special damage number.
        accuracy: oneShotThisVolley ? 100 : this.loadout.accuracy,
        criticalChance: oneShotThisVolley ? 0 : this.loadout.criticalChance,
        criticalDamage: this.loadout.criticalDamage,
        spreadDegrees: this.loadout.spreadDegrees,
        bulletSpeed: bulletSpeedForWeapon(this.loadout.weaponId),
        explosionRadius,
      },
    });

    // v59 fix: magazine consumption used to be capped by BOTH `this.magazine`
    // AND `this.ammo` in one `Math.min(rounds, magazine, ammo)` — the instant
    // ammo (today's reserve) hit exactly 0 while the magazine still had
    // rounds chambered (routine after any reload that topped the magazine up
    // right as the last of the reserve was drawn — e.g. right after a Spare
    // Weapon swap, but reachable without swapping too), `consumed` became 0
    // forever: the magazine could never drain again, so every further shot
    // fired completely free. Magazine depletion is now bounded ONLY by the
    // magazine itself — those rounds are already chambered, independent of
    // what the reserve does — while ammo/ammoUsed still track down in
    // lockstep but clamp at 0 without blocking the magazine.
    const magazineConsumed = Math.min(rounds, this.magazine);
    this.magazine = Math.max(0, this.magazine - magazineConsumed);
    const ammoConsumed = Math.min(magazineConsumed, this.ammo);
    this.ammo = Math.max(0, this.ammo - ammoConsumed);
    this.ammoUsed += ammoConsumed;
  }

  private startReload() {
    this.isReloading = true;
    // v37 fix: loops for the entire reload instead of two discrete clicks —
    // reloadDurationMs varies per weapon and the recorded sample doesn't
    // match any single one of them, so it needs to actually loop, not just
    // fire twice and leave the rest of the reload silent.
    this.reloadLoopHandle?.stop();
    this.reloadLoopHandle = sfx.startLoop("reload");
    this.reloadStartTime = this.scene.time.now;
    this.reloadDurationMs = this.loadout.reloadTime * 1000;
    this.scene.time.delayedCall(this.reloadDurationMs, () => {
      const needed = this.loadout.magazineSize - this.magazine;
      const filled = Math.min(needed, this.ammo);
      this.magazine += filled;
      this.isReloading = false;
      this.reloadLoopHandle?.stop();
      this.reloadLoopHandle = null;
    });
  }

  /** 0-1 reload progress, or -1 if not currently reloading — drives the HUD's reload bar. */
  getReloadProgress(): number {
    if (!this.isReloading || this.reloadDurationMs <= 0) return -1;
    return Phaser.Math.Clamp((this.scene.time.now - this.reloadStartTime) / this.reloadDurationMs, 0, 1);
  }

  /** v35: seconds left in the current reload (for the HUD's numeric
   *  countdown), or -1 if not currently reloading. */
  getReloadSecondsRemaining(): number {
    if (!this.isReloading || this.reloadDurationMs <= 0) return -1;
    const remainingMs = this.reloadDurationMs - (this.scene.time.now - this.reloadStartTime);
    return Math.max(0, remainingMs) / 1000;
  }

  getMagazine() { return this.magazine; }
  getMagazineSize() { return this.loadout.magazineSize; }
  getAmmoUsed() { return this.ammoUsed; }
  isOutOfAmmo() { return this.magazine <= 0 && this.ammo <= 0; }

  /** v35: ammo consumption for BOTH weapons this run (main always, spare
   *  only if it was ever swapped to) — game-complete reports usage per
   *  weaponId since each has its own separate daily ammo quota. */
  getAmmoUsageBreakdown(): { weaponId: string; ammoUsed: number }[] {
    const mainUsed = this.usingSpare ? this.offAmmoUsed : this.ammoUsed;
    const out = [{ weaponId: this.mainLoadout.weaponId, ammoUsed: mainUsed }];
    if (this.spareLoadout) {
      const spareUsed = this.usingSpare ? this.ammoUsed : this.offAmmoUsed;
      out.push({ weaponId: this.spareLoadout.weaponId, ammoUsed: spareUsed });
    }
    return out;
  }

  /** v60: Armor% no longer reduces incoming damage directly — it now boosts
   *  Total Shield capacity instead (see statsToLoadout/buildStatBreakdown in
   *  stats.ts, shieldMax already has the armor% bonus baked in before this
   *  loadout is ever built). Shield (from equipped gear + armor%) absorbs
   *  damage before HP and never regenerates mid-stage. */
  takeDamage(amount: number) {
    if (this.isInvincible || this.isDead || this.scene.time.now < this.neverDiedInvincibleUntil) return;
    this.applyToShieldThenHp(amount);
    this.setInvincible();
    if (this.hp <= 0) this.die();
  }

  /** AoE splash from a rocket/grenade explosion — always full damage (still shield-first). */
  takeAoeDamage(amount: number) {
    if (this.isDead || this.scene.time.now < this.neverDiedInvincibleUntil) return;
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

    // v50: Never Died — the moment HP would actually hit 0, intercept it here
    // (before takeDamage/takeAoeDamage's own `if (this.hp <= 0) this.die()`
    // runs) so death is prevented at the source instead of being undone after
    // the fact. Uses its own invincibility field rather than this.isInvincible
    // so the normal 0.3s post-hit i-frame timer (setInvincible(), called right
    // after this in takeDamage) can't cut the 3s window short.
    if (this.hp <= 0 && this.perks.neverDied && !this.neverDiedUsed) {
      this.hp = 1;
      this.neverDiedUsed = true;
      this.neverDiedInvincibleUntil = this.scene.time.now + NEVER_DIED_INVINCIBLE_MS;
      sfx.play("gacha_legendary");
      // v55: sustained gold tint + a pulsing glow ring around the character
      // for the FULL 3s window (was just a 1.5s tint flash) — the whole
      // point is to make "you're invincible right now" visible for as long
      // as it's actually true, not just at the moment it triggers.
      this.sprite.setTint(0xfbbf24);
      this.scene.tweens.add({ targets: this.sprite, alpha: 0.55, duration: 200, yoyo: true, repeat: Math.round(NEVER_DIED_INVINCIBLE_MS / 400) });
      const glow = this.scene.add.circle(this.sprite.x, this.sprite.y, UNIT_DISPLAY_SIZE * 0.7, 0xfbbf24, 0.28).setDepth(this.sprite.depth - 1);
      const glowTween = this.scene.tweens.add({ targets: glow, alpha: 0.55, scale: 1.25, duration: 350, yoyo: true, repeat: -1 });
      const followGlow = () => glow.setPosition(this.sprite.x, this.sprite.y);
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, followGlow);
      this.scene.time.delayedCall(NEVER_DIED_INVINCIBLE_MS, () => {
        this.sprite.clearTint();
        this.sprite.setAlpha(1);
        this.scene.events.off(Phaser.Scenes.Events.UPDATE, followGlow);
        glowTween.stop();
        glow.destroy();
      });
      // v52: dedicated on-screen banner (see HUDScene's onNeverDiedActivated)
      // so the save is unmistakable, not just a quiet tint flash.
      this.scene.events.emit("player-never-died");
    } else if (this.hp <= 0) {
      // v52 diagnostic: if a player with the perk still dies outright, this
      // line (visible in the browser console) says exactly why — either the
      // perk flag never reached this Player instance (perks.neverDied false)
      // or it already fired earlier this match (neverDiedUsed true).
      console.debug("[Player] fatal hit — neverDied perk:", this.perks.neverDied, "already used:", this.neverDiedUsed);
    }
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
    this.stopSounds();
  }

  /** v40: the reload loop (see startReload()) only ever gets stopped by its
   *  own completion timer or by dying mid-reload — if the stage instead ends
   *  from UNDER a still-reloading, still-alive player (cleared the last enemy,
   *  or exited via Pause) while mid-reload, nothing was cancelling the timer
   *  or the loop, so the reload sound played forever afterward (into
   *  GameOverScene, and even back at Home, since Web Audio loops aren't tied
   *  to any Phaser scene lifecycle). Called from GameScene's SHUTDOWN handler
   *  as a catch-all, same as sfx.stopMusicLoop(). */
  stopSounds() {
    this.reloadLoopHandle?.stop();
    this.reloadLoopHandle = null;
    this.isReloading = false;
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
