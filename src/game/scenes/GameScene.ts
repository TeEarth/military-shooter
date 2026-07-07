import Phaser from "phaser";
import { Player } from "@/game/entities/Player";
import { Enemy } from "@/game/entities/Enemy";
import { CoverObject, COVER_SIZES, type CoverType } from "@/game/entities/CoverObject";
import { MobileControls } from "@/game/entities/MobileControls";
import type { StageData } from "@/types/stage";
import type { EnemySpawn, EnemyData } from "@/types/enemy";
import type { CombatLoadout } from "@/types/loadout";
import { PLAYER_CONFIG } from "../../../config/player";
import { sfx } from "@/lib/sfx";

const FARM_BASE_ENEMY_COUNT = 3;
const FARM_SCALING_PER_WAVE = 1.1;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private covers!: Phaser.Physics.Arcade.StaticGroup;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;

  private stageData!: StageData;
  private isFarmStage = false;
  private enemyRoster: EnemyData[] = [];
  private currentWave = 1;
  private highestWaveCleared = 0;

  // v13: farm stage start sequence — 5s with no enemies so the player can get
  // their bearings, then wave 1 spawns but stays "frozen" (no movement, no
  // damage either direction) for 3s before combat actually starts. Only the
  // opening sequence gets this treatment; later wave transitions keep the
  // existing 1s gap + a banner, no freeze.
  private farmPhase: "countdown" | "freeze" | "active" = "active";
  private farmPhaseElapsed = 0;
  private static readonly FARM_COUNTDOWN_MS = 5000;
  private static readonly FARM_FREEZE_MS = 3000;

  private kills = 0;
  private deaths = 0;
  private startTime = 0;
  private score = 0;
  /** Real currency earned from kills this run (sum of each killed enemy's coinReward) —
   *  separate from `score`, which is a cosmetic HUD number only. This is what actually
   *  gets sent to /api/game/complete and credited to the player's coin balance. */
  private killCoin = 0;
  private stageEnded = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private shootKey!: Phaser.Input.Keyboard.Key;
  private reloadKey!: Phaser.Input.Keyboard.Key;
  private failedAssetKeys!: Set<string>;
  /** v13: set by the HUD's on-screen RELOAD button, consumed (and reset) by update(). */
  private reloadRequested = false;
  private mobileControls?: MobileControls;

  // v14: tree stealth mechanic — standing still, not attacking, and not being
  // attacked inside a tree's zone for HIDE_DURATION_MS makes the player
  // undetectable by enemy AI (Enemy.update() forced to "patrol" regardless of
  // distance). Any of those conditions breaking resets the timer to 0.
  private treeCovers: CoverObject[] = [];
  private hideTimer = 0;
  private isHidden = false;
  private playerHitThisFrame = false;
  private static readonly HIDE_DURATION_MS = 3000;
  /** Generous "in the bush" radius — bigger than the tiny bullet-pass-through
   *  hitbox, since this is a gameplay zone, not a pixel-precise collision. */
  private static readonly TREE_STEALTH_RADIUS = COVER_SIZES.tree.width * 0.7;

  constructor() {
    super({ key: "GameScene" });
  }

  create() {
    this.stageData = this.registry.get("stageData") as StageData;
    const enemySpawns = (this.registry.get("enemySpawns") as EnemySpawn[]) ?? [];
    this.enemyRoster = (this.registry.get("enemyRoster") as EnemyData[]) ?? [];
    const character = this.registry.get("character") as CombatLoadout;
    this.failedAssetKeys = (this.registry.get("failedAssetKeys") as Set<string>) ?? new Set();

    this.isFarmStage = this.stageData.isRepeatable;
    this.startTime = Date.now();
    this.stageEnded = false;

    // v14: quiet background battle music for the duration of the stage.
    sfx.startMusicLoop();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => sfx.stopMusicLoop());

    const { width: worldWidth, height: worldHeight } = this.stageData;

    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

    this.createBackground(worldWidth, worldHeight);

    this.covers = this.physics.add.staticGroup();
    this.createCovers(worldWidth, worldHeight);

    this.bullets = this.physics.add.group({ maxSize: 80, runChildUpdate: false });
    this.enemyBullets = this.physics.add.group({ maxSize: 150, runChildUpdate: false });
    this.enemyGroup = this.physics.add.group();

    // v11 #2: real designed spawn point from the stage-layout PDF, where
    // available — 0/undefined means "not designed", keep the old default.
    const spawnX = this.stageData.playerSpawnX || 120;
    const spawnY = this.stageData.playerSpawnY || worldHeight / 2;
    this.player = new Player(this, spawnX, spawnY, this.bullets, character, this.failedAssetKeys);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.reloadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.input.keyboard!.on("keydown-ESC", () => this.pauseGame());

    // v9 #6: only ever created when GameClient.tsx detected an actual touch
    // device under 768px wide — never shown/attached on desktop.
    if (this.registry.get("isMobile")) {
      this.mobileControls = new MobileControls(this);
    }

    if (this.isFarmStage) {
      // Wave 1 doesn't spawn immediately — see updateFarmPhase(), driven from update().
      this.farmPhase = "countdown";
      this.farmPhaseElapsed = 0;
    } else {
      for (const spawn of enemySpawns) {
        this.enemies.push(new Enemy(this, spawn.spawnX, spawn.spawnY, spawn, this.enemyBullets, this.enemyGroup, 1, 1, this.failedAssetKeys));
      }
    }

    // --- Collisions ---
    // v14: trees are walk-through/shoot-through (a hiding spot, not solid
    // cover) — every collider against `this.covers` skips anything tagged
    // coverType "tree" via its process callback.
    const notTree = (coverObj: unknown) => (coverObj as Phaser.Physics.Arcade.Image).getData("coverType") !== "tree";

    this.physics.add.collider(this.player.sprite, this.covers, undefined, notTree, this);
    this.physics.add.collider(this.enemyGroup, this.covers, undefined, notTree, this);

    // Bullets vanish on hitting a wall — except "lob" (grenade) bullets, which fly over cover.
    const skipIgnoreCover = (bulletObj: unknown, coverObj: unknown) =>
      !(bulletObj as Phaser.Physics.Arcade.Image).getData("ignoreCover") && notTree(coverObj);

    this.physics.add.collider(this.bullets, this.covers, (bulletObj) => {
      this.detonateBullet(bulletObj as Phaser.Physics.Arcade.Image, true);
    }, skipIgnoreCover, this);

    this.physics.add.collider(this.enemyBullets, this.covers, (bulletObj) => {
      this.detonateBullet(bulletObj as Phaser.Physics.Arcade.Image, false);
    }, skipIgnoreCover, this);

    this.physics.add.overlap(this.bullets, this.enemyGroup, (bulletObj, enemySpriteObj) => {
      this.onBulletHitEnemy(bulletObj as Phaser.Physics.Arcade.Image, enemySpriteObj as Phaser.Physics.Arcade.Image);
    });

    this.physics.add.overlap(this.enemyBullets, this.player.sprite, (_playerObj, bulletObj) => {
      this.onEnemyBulletHitPlayer(bulletObj as Phaser.Physics.Arcade.Image);
    });

    // Grenade Launcher: arrival-based detonation at the clicked target (see
    // WeaponFire.ts's "lob" case) — not collision-based, since the grenade
    // deliberately ignores cover the whole way there.
    this.events.on("lob-detonate", (data: { x: number; y: number; damage: number; isPlayerBullet: boolean; explosionRadius: number }) => {
      sfx.play("explosion");
      this.applyAoeSplash(data.x, data.y, data.damage, data.isPlayerBullet, data.explosionRadius);
    });

    this.scene.launch("HUDScene", { stageData: this.stageData });
  }

  private createBackground(worldWidth: number, worldHeight: number) {
    const hasBg = this.textures.exists("stage_bg") && !this.failedAssetKeys.has("stage_bg");

    if (hasBg) {
      this.add.tileSprite(0, 0, worldWidth, worldHeight, "stage_bg").setOrigin(0, 0).setDepth(0);
    } else {
      const hash = this.stageData.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const hue = hash % 360;
      const color = Phaser.Display.Color.HSLToColor(hue / 360, 0.35, 0.18).color;
      this.add.rectangle(worldWidth / 2, worldHeight / 2, worldWidth, worldHeight, color).setDepth(0);

      const grid = this.add.graphics().setDepth(1);
      grid.lineStyle(1, 0xffffff, 0.05);
      for (let x = 0; x < worldWidth; x += 200) grid.lineBetween(x, 0, x, worldHeight);
      for (let y = 0; y < worldHeight; y += 200) grid.lineBetween(0, y, worldWidth, y);
    }
  }

  private createCovers(worldWidth: number, worldHeight: number) {
    // v11 #2: stages designed from the stage-layout PDF ship a fixed cover
    // list (registry "stageCovers", from StageCover sheet via /api/game/start)
    // — any stage without one (not yet designed) keeps the old random scatter.
    const fixedCovers = (this.registry.get("stageCovers") as { coverType: string; x: number; y: number }[]) ?? [];
    if (fixedCovers.length > 0) {
      for (const c of fixedCovers) {
        const type = c.coverType as CoverType;
        if (!(type in COVER_SIZES)) continue;
        const { width, height } = COVER_SIZES[type];
        const cover = new CoverObject(this, c.x, c.y, width, height, type, this.covers, this.failedAssetKeys);
        if (type === "tree") this.treeCovers.push(cover);
      }
      return;
    }

    // All 6 obstacle types mixed together (shuffled, not repeating one type across
    // the whole stage) for a more varied, tactically interesting map. Count bumped
    // up from the old sandbag/crate-only baseline for more cover options.
    const types: CoverType[] = ["sandbag", "crate", "tree", "wall", "house", "camp_tent"];
    const coverCount = Math.max(10, Math.floor(worldWidth / 160));

    for (let i = 0; i < coverCount; i++) {
      const x = 350 + i * (worldWidth - 700) / coverCount + Phaser.Math.Between(-60, 60);
      const y = Phaser.Math.Between(120, worldHeight - 120);
      const type = Phaser.Utils.Array.GetRandom(types);
      const { width, height } = COVER_SIZES[type];
      const cover = new CoverObject(this, x, y, width, height, type, this.covers, this.failedAssetKeys);
      if (type === "tree") this.treeCovers.push(cover);
    }
  }

  private randomSpawnPoint(): { x: number; y: number } {
    const { width, height } = this.stageData;
    return {
      x: Phaser.Math.Between(width * 0.3, width - 80),
      y: Phaser.Math.Between(80, height - 80),
    };
  }

  private spawnWave(wave: number) {
    if (this.enemyRoster.length === 0) return;
    const enemyCount = FARM_BASE_ENEMY_COUNT + Math.floor((wave - 1) / 3);
    const multiplier = Math.pow(FARM_SCALING_PER_WAVE, wave - 1);

    for (let i = 0; i < enemyCount; i++) {
      const template = Phaser.Utils.Array.GetRandom(this.enemyRoster);
      const { x, y } = this.randomSpawnPoint();
      const spawn: EnemySpawn = { ...template, spawnX: x, spawnY: y };
      this.enemies.push(new Enemy(this, x, y, spawn, this.enemyBullets, this.enemyGroup, multiplier, multiplier, this.failedAssetKeys));
    }

    // v13: "which wave is coming up" on-screen banner, every wave transition.
    this.events.emit("farm-wave-start", wave);

    // v14: EVERY wave (not just the first) freezes the newly-spawned enemies
    // for a beat so the player isn't ambushed the instant a wave starts —
    // spawnWave() is the single choke point for all farm-stage wave starts,
    // so setting freeze here covers wave 1 (via updateFarmPhase's countdown
    // transition) and every later wave (via checkWinCondition's delayed call)
    // uniformly.
    this.farmPhase = "freeze";
    this.farmPhaseElapsed = 0;
    this.startFreezeBlink();
  }

  /** v14: frozen enemies blink (alpha yoyo) for the whole freeze window, so
   *  it's visually obvious they can't be hit/can't hit back right now. */
  private startFreezeBlink() {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      this.tweens.add({
        targets: enemy.sprite,
        alpha: 0.3,
        duration: 200,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private stopFreezeBlink() {
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      this.tweens.killTweensOf(enemy.sprite);
      enemy.sprite.setAlpha(1);
    }
  }

  /** v13: drives the farm stage's opening sequence — 5s with no enemies, then
   *  wave 1 spawns but stays frozen (no movement/damage either direction) for
   *  3s more. Called every frame from update() while isFarmStage; a no-op
   *  once farmPhase reaches "active". */
  private updateFarmPhase(delta: number) {
    if (this.farmPhase === "active") return;
    this.farmPhaseElapsed += delta;

    if (this.farmPhase === "countdown") {
      const remainingMs = Math.max(0, GameScene.FARM_COUNTDOWN_MS - this.farmPhaseElapsed);
      this.events.emit("farm-countdown", Math.ceil(remainingMs / 1000));
      if (this.farmPhaseElapsed >= GameScene.FARM_COUNTDOWN_MS) {
        this.events.emit("farm-countdown", 0);
        this.spawnWave(this.currentWave); // also sets farmPhase="freeze" + starts the blink
      }
    } else if (this.farmPhase === "freeze" && this.farmPhaseElapsed >= GameScene.FARM_FREEZE_MS) {
      this.farmPhase = "active";
      this.stopFreezeBlink();
    }
  }

  private detonateBullet(bullet: Phaser.Physics.Arcade.Image, isPlayerBullet: boolean) {
    if (bullet.getData("isAoe")) {
      sfx.play("explosion");
      const radius = Number(bullet.getData("explosionRadius") ?? PLAYER_CONFIG.aoeRadius);
      this.applyAoeSplash(bullet.x, bullet.y, Number(bullet.getData("damage") ?? 0), isPlayerBullet, radius);
    }
    bullet.destroy();
  }

  /** v8 #11: a target standing right where the explosion lands takes full damage;
   *  anyone else in the radius but not at that exact point takes a flat 60% splash
   *  share — deliberately just these 2 tiers, not a distance-scaled falloff. */
  private static readonly DIRECT_HIT_EPSILON = 10;
  private static readonly SPLASH_DAMAGE_FRACTION = 0.6;

  private applyAoeSplash(x: number, y: number, damage: number, isPlayerBullet: boolean, radius: number = PLAYER_CONFIG.aoeRadius) {
    if (damage <= 0) return;
    if (this.farmPhase === "freeze") return; // v13: no damage either direction during the farm-stage freeze window
    const explosion = this.add.circle(x, y, radius, 0xff8800, 0.35).setDepth(15);
    this.tweens.add({ targets: explosion, alpha: 0, scale: 1.3, duration: 300, onComplete: () => explosion.destroy() });

    if (isPlayerBullet) {
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        const dist = Phaser.Math.Distance.Between(x, y, enemy.sprite.x, enemy.sprite.y);
        if (dist > radius) continue;
        const appliedDamage = dist <= GameScene.DIRECT_HIT_EPSILON ? damage : Math.round(damage * GameScene.SPLASH_DAMAGE_FRACTION);
        const dead = enemy.takeDamage(appliedDamage);
        if (dead) {
          this.kills++;
          this.score += enemy.getCoinReward() * 10;
          this.killCoin += enemy.getCoinReward();
          this.showCoinPopup(enemy.sprite.x, enemy.sprite.y, enemy.getCoinReward());
          this.enemyGroup.remove(enemy.sprite);
        }
      }
    } else {
      const dist = Phaser.Math.Distance.Between(x, y, this.player.sprite.x, this.player.sprite.y);
      if (dist <= radius) {
        const appliedDamage = dist <= GameScene.DIRECT_HIT_EPSILON ? damage : Math.round(damage * GameScene.SPLASH_DAMAGE_FRACTION);
        this.player.takeAoeDamage(appliedDamage);
        this.playerHitThisFrame = true; // v14: breaks tree stealth timer
        if (this.player.isDead) {
          this.deaths++;
          this.handlePlayerDeath();
        }
      }
    }
  }

  private onBulletHitEnemy(bullet: Phaser.Physics.Arcade.Image, enemySprite: Phaser.Physics.Arcade.Image) {
    // Guard against a single bullet ever damaging more than one enemy: Arcade's
    // overlap() reports every overlapping pair within the same physics step, so
    // if a bullet is briefly overlapping two enemies at once, only the first
    // callback invocation may process it — this flag makes that atomic. The
    // bullet is destroyed unconditionally right here (not after the
    // hit/miss/AoE branching below) so it can never continue flying past
    // whatever it first touched, hit or miss.
    if (!bullet.active || bullet.getData("hasHit")) return;
    bullet.setData("hasHit", true);

    const damage = Number(bullet.getData("damage") ?? 0);
    const isMiss = bullet.getData("isMiss") === true;
    const isAoe = bullet.getData("isAoe") === true;
    const explosionRadius = Number(bullet.getData("explosionRadius") ?? PLAYER_CONFIG.aoeRadius);
    const impactX = bullet.x;
    const impactY = bullet.y;
    bullet.destroy();

    const enemy = this.enemies.find((e) => e.sprite === enemySprite);
    if (!enemy || enemy.isDead) return;

    if (isAoe) {
      sfx.play("explosion");
      this.applyAoeSplash(impactX, impactY, damage, true, explosionRadius);
      return;
    }

    if (this.farmPhase === "freeze") {
      this.showFloatingText(enemySprite.x, enemySprite.y, "FROZEN", "#66ccff");
      return; // v13: enemies can't be damaged during the farm-stage freeze window
    }

    if (isMiss || damage <= 0) {
      sfx.play("miss");
      this.showFloatingText(enemySprite.x, enemySprite.y, "MISS", "#999999");
      return;
    }

    sfx.play("hit_enemy");
    const dead = enemy.takeDamage(damage);
    this.showFloatingText(enemySprite.x, enemySprite.y, `-${damage}`, "#f39c12");

    if (dead) {
      this.kills++;
      this.score += enemy.getCoinReward() * 10;
      this.killCoin += enemy.getCoinReward();
      this.showCoinPopup(enemySprite.x, enemySprite.y, enemy.getCoinReward());
      this.enemyGroup.remove(enemySprite);
    }
  }

  private onEnemyBulletHitPlayer(bullet: Phaser.Physics.Arcade.Image) {
    if (!bullet.active || bullet.getData("hasHit")) return;
    bullet.setData("hasHit", true);

    const damage = Number(bullet.getData("damage") ?? 0);
    const isMiss = bullet.getData("isMiss") === true;
    const isAoe = bullet.getData("isAoe") === true;
    const explosionRadius = Number(bullet.getData("explosionRadius") ?? PLAYER_CONFIG.aoeRadius);
    const impactX = bullet.x;
    const impactY = bullet.y;
    bullet.destroy();

    if (isAoe) {
      sfx.play("explosion");
      this.applyAoeSplash(impactX, impactY, damage, false, explosionRadius);
      return;
    }

    if (this.player.isInvincible) return;
    if (this.farmPhase === "freeze") return; // v13: defensive — enemies don't fire during freeze, but a bullet already mid-flight when freeze started shouldn't land damage either

    if (isMiss || damage <= 0) {
      sfx.play("miss");
      this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 20, "MISS", "#999999");
      return;
    }

    sfx.play("hurt_player");
    this.player.takeDamage(damage);
    this.playerHitThisFrame = true; // v14: breaks tree stealth timer
    this.showFloatingText(this.player.sprite.x, this.player.sprite.y - 20, `-${Math.round(damage)}`, "#ff4444");

    if (this.player.isDead) {
      this.deaths++;
      this.handlePlayerDeath();
    }
  }

  /** v8 #7: permadeath applies to EVERY mode, farm included — dying ends the run
   *  immediately (GAME OVER, showing the wave reached for farm), no mid-wave/
   *  mid-stage respawn anywhere. Only "Play Again" (retry) starts a fresh attempt. */
  private handlePlayerDeath() {
    this.time.delayedCall(1500, () => this.endStage(false));
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const label = this.add.text(x, y, text, { fontFamily: "Orbitron, monospace", fontSize: "12px", color }).setOrigin(0.5).setDepth(20);
    this.tweens.add({ targets: label, y: y - 30, alpha: 0, duration: 600, onComplete: () => label.destroy() });
  }

  /** Coin icon + amount floating up from an enemy's death spot — same
   *  float-up-and-fade pattern as showFloatingText's damage numbers. */
  private showCoinPopup(x: number, y: number, coinReward: number) {
    const hasIcon = this.textures.exists("coin_pop");
    const icon = hasIcon
      ? this.add.image(x - 10, y, "coin_pop").setDepth(20)
      : this.add.text(x - 10, y, "🪙", { fontSize: "14px" }).setOrigin(0.5).setDepth(20);
    const label = this.add.text(x + 8, y, `+${coinReward}`, {
      fontFamily: "Orbitron, monospace", fontSize: "12px", color: "#f39c12", fontStyle: "bold",
    }).setOrigin(0, 0.5).setDepth(20);

    this.tweens.add({
      targets: [icon, label],
      y: y - 34,
      alpha: 0,
      duration: 700,
      onComplete: () => { icon.destroy(); label.destroy(); },
    });
  }

  update(_time: number, delta: number) {
    if (this.stageEnded) return;

    let moveLeft = this.cursors.left.isDown || this.wasd.A.isDown;
    let moveRight = this.cursors.right.isDown || this.wasd.D.isDown;
    let moveUp = this.cursors.up.isDown || this.wasd.W.isDown;
    let moveDown = this.cursors.down.isDown || this.wasd.S.isDown;
    let isShooting = this.shootKey.isDown || this.input.activePointer.isDown;
    // v13: the on-screen RELOAD button pulses this.reloadRequested for exactly
    // one frame, same one-shot semantics as JustDown(R) below.
    const isReloading = Phaser.Input.Keyboard.JustDown(this.reloadKey) || this.reloadRequested;
    this.reloadRequested = false;

    const pointer = this.input.activePointer;
    let worldPointer = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    if (this.mobileControls) {
      const move = this.mobileControls.getMoveVector();
      const DEAD_ZONE = 0.3;
      moveLeft = move.x < -DEAD_ZONE;
      moveRight = move.x > DEAD_ZONE;
      moveUp = move.y < -DEAD_ZONE;
      moveDown = move.y > DEAD_ZONE;

      // v14: tap-and-hold anywhere on the right half aims AND fires at that
      // exact screen point (converted to world space, same as the desktop
      // mouse pointer) — no separate aim-stick/fire-button pair. This is what
      // makes the Grenade Launcher's lob land exactly where you tapped.
      const aimPoint = this.mobileControls.getAimScreenPoint();
      isShooting = aimPoint !== null;
      if (aimPoint) {
        worldPointer = this.cameras.main.getWorldPoint(aimPoint.x, aimPoint.y);
      }
    }

    if (this.isFarmStage) this.updateFarmPhase(delta);
    const frozen = this.farmPhase === "freeze";

    this.player.update(moveLeft, moveRight, moveUp, moveDown, isShooting, isReloading, worldPointer, delta, this.covers);

    const isMoving = moveLeft || moveRight || moveUp || moveDown;
    this.updateStealth(isMoving, isShooting, delta);

    // v13: during the post-spawn freeze window, enemies don't move/shoot at
    // all — combined with the no-damage guards in the hit handlers below,
    // this is what makes freeze a true "both sides harmless" pause, not just
    // a visual one.
    if (!frozen) {
      for (const enemy of this.enemies) {
        // v14: while hidden in a tree, enemies have no idea where the player
        // is — forced to "patrol" regardless of distance/line-of-sight.
        if (!enemy.isDead) enemy.update(this.player.sprite.x, this.player.sprite.y, this.isHidden);
      }
    }

    this.checkWinCondition();

    this.events.emit("hud-update", {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      shieldMax: this.player.shieldMax,
      magazine: this.player.getMagazine(),
      magazineSize: this.player.getMagazineSize(),
      ammo: this.player.ammo,
      maxAmmo: this.player.maxAmmo,
      isReloading: this.player.isReloading,
      reloadProgress: this.player.getReloadProgress(),
      outOfAmmo: this.player.isOutOfAmmo(),
      kills: this.kills,
      score: this.score,
      wave: this.isFarmStage ? this.currentWave : undefined,
      isFarmStage: this.isFarmStage,
      playerPos: { x: this.player.sprite.x, y: this.player.sprite.y },
      enemyPositions: this.enemies.filter((e) => !e.isDead).map((e) => ({ x: e.sprite.x, y: e.sprite.y })),
      stageWidth: this.stageData.width,
      stageHeight: this.stageData.height,
      hideProgress: Math.min(1, this.hideTimer / GameScene.HIDE_DURATION_MS),
      isHidden: this.isHidden,
    });

    // Consumed above (as "hit this frame") — reset for the next physics step.
    this.playerHitThisFrame = false;
  }

  /** v14: tree stealth — 3s stationary + non-combat inside a tree's zone makes
   *  the player undetectable; moving, shooting, entering/leaving the zone, or
   *  being hit all reset the timer to 0. */
  private updateStealth(isMoving: boolean, isShooting: boolean, delta: number) {
    const inTreeZone = this.treeCovers.some(
      (t) => Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, t.sprite.x, t.sprite.y) <= GameScene.TREE_STEALTH_RADIUS
    );

    const canProgress = inTreeZone && !isMoving && !isShooting && !this.playerHitThisFrame && !this.player.isDead;

    if (canProgress) {
      this.hideTimer += delta;
      if (this.hideTimer >= GameScene.HIDE_DURATION_MS) {
        this.isHidden = true;
      }
    } else {
      this.hideTimer = 0;
      this.isHidden = false;
    }

    this.player.sprite.setAlpha(this.isHidden ? 0.35 : 1);
  }

  private checkWinCondition() {
    const anyAlive = this.enemies.some((e) => !e.isDead);
    if (anyAlive) return;
    if (this.enemies.length === 0) return; // nothing spawned yet

    if (this.isFarmStage) {
      this.highestWaveCleared = this.currentWave;
      this.currentWave++;
      this.enemies = [];
      this.time.delayedCall(1000, () => this.spawnWave(this.currentWave));
    } else {
      this.endStage(true);
    }
  }

  endStage(completed: boolean) {
    if (this.stageEnded) return;
    this.stageEnded = true;

    const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
    const onGameEnd = this.registry.get("onGameEnd") as (r: unknown) => Promise<void>;
    if (onGameEnd) {
      onGameEnd({
        kills: this.kills,
        deaths: this.deaths,
        timeTaken,
        score: this.score,
        killCoin: this.killCoin,
        completed,
        ammoUsed: this.player.getAmmoUsed(),
        farmWaveReached: this.isFarmStage ? this.highestWaveCleared : undefined,
      });
    }

    this.scene.stop("HUDScene");
    this.scene.start("GameOverScene", { completed, kills: this.kills, deaths: this.deaths, score: this.score, stageId: this.registry.get("stageId") });
  }

  pauseGame() {
    if (this.stageEnded || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.pause("HUDScene");
    this.scene.launch("PauseScene");
  }

  /** Mid-stage ammo refill (v7 #3) — launched from a HUD button, not just Pause. */
  openAmmoRefill() {
    if (this.stageEnded || this.scene.isPaused()) return;
    this.scene.pause();
    this.scene.pause("HUDScene");
    this.scene.launch("AmmoRefillScene");
  }

  /** v13: on-screen RELOAD button — sets the same one-frame pulse the R key
   *  sets, consumed on the next update(). */
  triggerReload() {
    if (this.stageEnded || this.scene.isPaused()) return;
    this.reloadRequested = true;
  }

  /** Called by AmmoRefillScene after a successful refill to update the live Player instance. */
  setAmmo(remaining: number) {
    this.player.ammo = remaining;
  }

  /** Called when the player exits mid-game (Pause → Exit to Home) — reports
   *  progress (ammo used, farm wave reached, kills) without marking the stage
   *  "completed", so farm-wave records and ammo spend still persist. */
  reportProgressOnExit() {
    if (this.stageEnded) return;
    this.stageEnded = true;

    const timeTaken = Math.floor((Date.now() - this.startTime) / 1000);
    const onGameEnd = this.registry.get("onGameEnd") as (r: unknown) => Promise<void>;
    if (onGameEnd) {
      onGameEnd({
        kills: this.kills,
        deaths: this.deaths,
        timeTaken,
        score: this.score,
        killCoin: this.killCoin,
        completed: false,
        ammoUsed: this.player.getAmmoUsed(),
        farmWaveReached: this.isFarmStage ? this.highestWaveCleared : undefined,
      });
    }
  }
}
