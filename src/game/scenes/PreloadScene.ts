import Phaser from "phaser";
import type { StageData } from "@/types/stage";
import type { EnemySpawn, EnemyData } from "@/types/enemy";
import type { CombatLoadout } from "@/types/loadout";
import { COVER_SPRITE_PATHS, COVER_SIZES } from "@/game/entities/CoverObject";
import { UNIT_DISPLAY_SIZE } from "../../../config/player";
import { getWeaponSprite } from "@/lib/spriteHelpers";
import { bulletDisplaySize } from "@/lib/bulletOrientation";

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private failedKeys = new Set<string>();

  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    const { width, height } = this.scale;
    const stageData = this.registry.get("stageData") as StageData;
    const character = this.registry.get("character") as CombatLoadout | undefined;
    const enemySpawns = (this.registry.get("enemySpawns") as EnemySpawn[]) ?? [];
    const enemyRoster = (this.registry.get("enemyRoster") as EnemyData[]) ?? [];

    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x2d5a27, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    this.progressBar = this.add.graphics();

    this.add.text(width / 2, height / 2 - 40, "LOADING MISSION...", {
      fontFamily: "Orbitron, monospace",
      fontSize: "14px",
      color: "#c5a97d",
    }).setOrigin(0.5);

    this.load.on("progress", (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0xf39c12, 1);
      this.progressBar.fillRect(width / 2 - 158, height / 2 - 13, 316 * value, 26);
    });

    // Track missing assets so we can synthesize placeholder textures in create().
    // This lets the game run immediately even before real art is dropped into /public/assets/.
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      this.failedKeys.add(file.key);
    });

    this.load.setPath("");

    // Background — tileable 512x512 pattern, loaded at native size and tiled by GameScene.
    if (stageData?.background) {
      this.load.svg("stage_bg", stageData.background, { width: 512, height: 512 });
    }

    // Character body — rasterized directly at the FINAL on-screen size (not a
    // larger native size later downscaled). Loading at the exact display size
    // means Player.ts/Enemy.ts never need setDisplaySize() and the Arcade
    // physics body radius always matches the visible sprite 1:1 — no
    // scale-vs-native-frame mismatch between the rendered sprite and its
    // collision body (that mismatch was the root cause of the player
    // occasionally vanishing/getting stuck, and enemies slipping past world
    // bounds — a body sized/offset in the wrong coordinate space).
    if (character?.sprite) this.load.svg("char_sprite", character.sprite, { width: UNIT_DISPLAY_SIZE, height: UNIT_DISPLAY_SIZE });

    // v10 #3: weapon layer sprite shown in the player's hands, swapped to
    // match whatever weapon is actually equipped instead of a fixed look.
    // Keyed by weaponId (not a fixed "weapon_sprite" key) so a mid-session
    // weapon switch — which reloads the whole scene via GameClient's retry
    // path — always loads the newly-equipped weapon's own art.
    if (character?.weaponId) {
      this.load.svg(`weapon_sprite_${character.weaponId}`, getWeaponSprite(character.weaponId), { width: 20, height: 40 });
    }

    // Bullet sprite is chosen per-weapon (round/razor/rocket/grenade), not per-character.
    // v34: loaded at each sprite's own aspect ratio (see bulletOrientation.ts)
    // instead of forcing every bullet into the same square texture — a
    // squished elongated sprite is exactly what made travel direction
    // unreadable regardless of how it's rotated.
    if (character?.bulletSprite) {
      const { width, height } = bulletDisplaySize(character.bulletSprite);
      this.load.svg("bullet_sprite", character.bulletSprite, { width, height });
    }

    // v35: Spare Weapon perk — preloads the swap slot's own gun art (already
    // keyed by weaponId, so no collision with the main weapon) and a SECOND
    // fixed-key bullet texture (Player.ts's shoot() can't dynamically load a
    // texture mid-fight, so both possible bullet types must already be in
    // the texture cache before the stage starts).
    const spareLoadout = this.registry.get("spareLoadout") as CombatLoadout | null;
    if (spareLoadout?.weaponId) {
      this.load.svg(`weapon_sprite_${spareLoadout.weaponId}`, getWeaponSprite(spareLoadout.weaponId), { width: 20, height: 40 });
    }
    if (spareLoadout?.bulletSprite) {
      const { width, height } = bulletDisplaySize(spareLoadout.bulletSprite);
      this.load.svg("bullet_sprite_spare", spareLoadout.bulletSprite, { width, height });
    }

    // One image per distinct enemy type appearing in this session (story spawns + farm roster),
    // also loaded directly at final display size for the same reason as the player.
    const seenEnemySprites = new Set<string>();
    // Seeded with the player's own weapon (already queued above) so an enemy
    // carrying the same weapon never queues a duplicate load for that key.
    const seenEnemyWeapons = new Set<string>(character?.weaponId ? [character.weaponId] : []);
    const allEnemyRefs = [...enemySpawns, ...enemyRoster];
    for (const enemy of allEnemyRefs) {
      if (enemy.sprite && !seenEnemySprites.has(enemy.id)) {
        seenEnemySprites.add(enemy.id);
        this.load.svg(`enemy_sprite_${enemy.id}`, enemy.sprite, { width: UNIT_DISPLAY_SIZE, height: UNIT_DISPLAY_SIZE });
      }
      // v31 fix: enemies previously all showed the same generic gun shape
      // baked into their body art, with no way to tell a shotgunner from a
      // sniper by sight — loading the real weapon sprite here (same asset/key
      // convention as the player's own `weapon_sprite_${weaponId}`, see
      // Enemy.ts) lets Enemy.ts show the actual weapon it's carrying.
      if (enemy.weaponId && !seenEnemyWeapons.has(enemy.weaponId)) {
        seenEnemyWeapons.add(enemy.weaponId);
        this.load.svg(`weapon_sprite_${enemy.weaponId}`, getWeaponSprite(enemy.weaponId), { width: 20, height: 40 });
      }
    }

    // Cover object art isn't sheet-driven (covers are procedurally scattered, not
    // per-stage rows) — fixed paths per type, loaded at each type's own on-screen
    // size (trees/houses are bigger than crates/sandbags) so the SVG rasterizes crisp.
    for (const [type, path] of Object.entries(COVER_SPRITE_PATHS)) {
      const size = COVER_SIZES[type as keyof typeof COVER_SIZES];
      this.load.svg(`cover_sprite_${type}`, path, { width: size.width, height: size.height });
    }

    // Coin popup icon shown floating up from an enemy's death spot (see GameScene's showCoinPopup).
    this.load.svg("coin_pop", "/assets/sprites/ui/coin_pop.svg", { width: 20, height: 20 });

    // v61: HUD perk-status icons — same custom designs as the Character page's
    // Icon component (regen/shield/invisible/neverDied), rendered as real
    // Phaser Image objects instead of default-emoji Text.
    this.load.svg("icon_regen", "/assets/sprites/ui/icon_regen.svg", { width: 20, height: 20 });
    this.load.svg("icon_shield", "/assets/sprites/ui/icon_shield.svg", { width: 20, height: 20 });
    this.load.svg("icon_invisible", "/assets/sprites/ui/icon_invisible.svg", { width: 20, height: 20 });
    this.load.svg("icon_neverdied", "/assets/sprites/ui/icon_neverdied.svg", { width: 20, height: 20 });
    // v62: the ammo Refill button now shows the game's OWN real bullet asset
    // (the same round used in-flight for gunplay) instead of a hand-drawn
    // icon, per request — loaded at its native aspect (16x28) and shown 5
    // in a row like a small stack of spare rounds.
    this.load.svg("icon_ammo", "/assets/sprites/bullets/bullet_round.svg", { width: 16, height: 28 });

    // PvP only: the opponent's character/weapon art, keyed with an "opponent_"
    // prefix so it never collides with the local player's own textures even
    // when both combatants happen to use the same character/weapon.
    const pvpOpponent = this.registry.get("pvpOpponent") as { sprite: string; weaponId: string } | undefined;
    if (pvpOpponent?.sprite) this.load.svg("opponent_char_sprite", pvpOpponent.sprite, { width: UNIT_DISPLAY_SIZE, height: UNIT_DISPLAY_SIZE });
    if (pvpOpponent?.weaponId) this.load.svg(`opponent_weapon_sprite_${pvpOpponent.weaponId}`, getWeaponSprite(pvpOpponent.weaponId), { width: 20, height: 40 });
  }

  create() {
    this.registry.set("failedAssetKeys", this.failedKeys);
    const nextScene = this.registry.get("pvpMatchId")
      ? "PvpScene"
      : this.registry.get("stageId") === "tutorial"
        ? "TutorialScene"
        : "GameScene";
    this.scene.start(nextScene);
  }
}
