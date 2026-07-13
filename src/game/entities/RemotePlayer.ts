import Phaser from "phaser";
import { UNIT_DISPLAY_SIZE } from "../../../config/player";

export interface RemoteSnapshot {
  x: number;
  y: number;
  rotation: number;
  hp: number;
  maxHp: number;
  isDead: boolean;
  weaponId: string;
  firing: boolean;
}

/**
 * The opponent in a PvP match — purely render-driven from Realtime snapshots
 * broadcast by the opponent's own client (see PvpScene). No local AI, no
 * input handling, no ammo/reload bookkeeping — that all lives on THEIR
 * client, which is authoritative over their own hp/position. This client
 * only needs enough of a physics body to detect "my bullets hit them"
 * locally (see PvpScene's bullet-vs-remotePlayer overlap).
 */
export class RemotePlayer {
  scene: Phaser.Scene;
  sprite: Phaser.Physics.Arcade.Image;
  private weaponSprite?: Phaser.GameObjects.Image;
  private hpBar: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private muzzleFlash: Phaser.GameObjects.Arc;
  /** v25: dying just faded the sprite to 30% alpha, which against grass/rock
   *  backgrounds read as "the opponent just vanished" rather than "they
   *  died" — this label makes the state unambiguous instead of looking like
   *  a rendering glitch. */
  private defeatedText: Phaser.GameObjects.Text;

  hp = 100;
  maxHp = 100;
  isDead = false;
  private currentWeaponId = "";
  private wasFiring = false;

  constructor(scene: Phaser.Scene, x: number, y: number, username: string, sprite: string, failedAssetKeys?: Set<string>) {
    this.scene = scene;

    const hasRealSprite = sprite && scene.textures.exists("opponent_char_sprite") && !failedAssetKeys?.has("opponent_char_sprite");
    let key = "opponent_char_sprite";
    if (!hasRealSprite) {
      key = "remote_player_tex";
      if (!scene.textures.exists(key)) {
        const half = UNIT_DISPLAY_SIZE / 2;
        const gfx = scene.add.graphics();
        gfx.fillStyle(0xc0392b, 1);
        gfx.fillCircle(half, half, half);
        gfx.fillStyle(0xf3c98a, 1);
        gfx.fillCircle(half, half - 10, 6);
        gfx.generateTexture(key, UNIT_DISPLAY_SIZE, UNIT_DISPLAY_SIZE);
        gfx.destroy();
      }
    }

    this.sprite = scene.physics.add.image(x, y, key);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setCircle(UNIT_DISPLAY_SIZE / 2);
    this.sprite.setDepth(10);
    this.sprite.setImmovable(true);
    (this.sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (this.sprite.body as Phaser.Physics.Arcade.Body).moves = false; // position is set explicitly from network snapshots, not physics velocity

    this.hpBar = scene.add.graphics().setDepth(21);
    this.nameText = scene.add.text(x, y - 44, username, {
      fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#ff8080",
    }).setOrigin(0.5).setDepth(21);

    this.muzzleFlash = scene.add.circle(x, y, 6, 0xffdd55, 0.9).setDepth(12).setVisible(false);

    this.defeatedText = scene.add.text(x, y, "DEFEATED", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#ff4444", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(22).setVisible(false);

    this.updateHpBar();
  }

  /** Swaps the weapon sprite texture — called once we know/change the opponent's weaponId. */
  private ensureWeaponSprite(weaponId: string, failedAssetKeys?: Set<string>) {
    if (weaponId === this.currentWeaponId) return;
    this.currentWeaponId = weaponId;

    const weaponKey = `opponent_weapon_sprite_${weaponId}`;
    this.weaponSprite?.destroy();
    this.weaponSprite = undefined;
    if (this.scene.textures.exists(weaponKey) && !failedAssetKeys?.has(weaponKey)) {
      this.weaponSprite = this.scene.add.image(this.sprite.x, this.sprite.y, weaponKey).setOrigin(0.5, 0.7).setDepth(this.sprite.depth + 1);
    } else if (this.scene.textures.exists(`weapon_sprite_${weaponId}`)) {
      // Fallback: reuse the local player's already-loaded weapon texture if the
      // two combatants happen to share a weapon (avoids a near-guaranteed
      // duplicate-load miss for the common case).
      this.weaponSprite = this.scene.add.image(this.sprite.x, this.sprite.y, `weapon_sprite_${weaponId}`).setOrigin(0.5, 0.7).setDepth(this.sprite.depth + 1);
    }
  }

  /** Applies the latest network snapshot — call once per received broadcast message. */
  applySnapshot(snap: RemoteSnapshot, failedAssetKeys?: Set<string>) {
    this.hp = snap.hp;
    this.maxHp = snap.maxHp;
    this.isDead = snap.isDead;

    // TEMP DEBUG (v25): remove once the "opponent vanishes on hit" root cause
    // is confirmed. Logs the exact render state every snapshot so we can see
    // what actually changes at the instant it disappears.
    console.log("[RP-DEBUG]", {
      hp: this.hp, maxHp: this.maxHp, isDead: this.isDead,
      spriteVisible: this.sprite.visible, spriteAlpha: this.sprite.alpha,
      textureKey: this.sprite.texture?.key, active: this.sprite.active,
      x: Math.round(snap.x), y: Math.round(snap.y),
    });

    this.sprite.setPosition(snap.x, snap.y);
    this.sprite.setRotation(snap.rotation);
    this.sprite.setAlpha(this.isDead ? 0.3 : 1);
    this.sprite.setVisible(true); // defensive — nothing should ever hide this outright, but never silently stay invisible if something does
    (this.sprite.body as Phaser.Physics.Arcade.Body).enable = !this.isDead;

    this.ensureWeaponSprite(snap.weaponId, failedAssetKeys);
    if (this.weaponSprite) {
      this.weaponSprite.setPosition(snap.x, snap.y);
      this.weaponSprite.setRotation(snap.rotation);
      this.weaponSprite.setVisible(!this.isDead);
    }

    this.nameText.setPosition(snap.x, snap.y - 44);
    this.defeatedText.setPosition(snap.x, snap.y - 28).setVisible(this.isDead);
    this.muzzleFlash.setPosition(snap.x + Math.cos(snap.rotation - Math.PI / 2) * 20, snap.y + Math.sin(snap.rotation - Math.PI / 2) * 20);

    // Cosmetic-only muzzle flash on the rising edge of "firing" — no real
    // bullet is spawned for the opponent's shots on this client; damage
    // arrives via a "hit" broadcast from THEIR client instead (see PvpScene).
    if (snap.firing && !this.wasFiring && !this.isDead) {
      this.muzzleFlash.setVisible(true).setAlpha(1);
      this.scene.tweens.add({ targets: this.muzzleFlash, alpha: 0, duration: 120, onComplete: () => this.muzzleFlash.setVisible(false) });
    }
    this.wasFiring = snap.firing;

    this.updateHpBar();
  }

  private updateHpBar() {
    this.hpBar.clear();
    if (this.isDead) return;
    const x = this.sprite.x - 20;
    const y = this.sprite.y - 34;
    this.hpBar.fillStyle(0x440000, 1);
    this.hpBar.fillRect(x, y, 40, 5);
    this.hpBar.fillStyle(0xc0392b, 1);
    this.hpBar.fillRect(x, y, 40 * Math.max(0, this.hp / this.maxHp), 5);
  }

  destroy() {
    this.sprite.destroy();
    this.weaponSprite?.destroy();
    this.hpBar.destroy();
    this.nameText.destroy();
    this.muzzleFlash.destroy();
    this.defeatedText.destroy();
  }
}
