import Phaser from "phaser";
import { sfx } from "@/lib/sfx";

interface HudUpdatePayload {
  hp: number;
  maxHp: number;
  shield: number;
  shieldMax: number;
  magazine: number;
  magazineSize: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  /** 0-1, or -1 when not reloading. */
  reloadProgress: number;
  outOfAmmo: boolean;
  kills: number;
  score: number;
  wave?: number;
  isFarmStage: boolean;
  playerPos: { x: number; y: number };
  enemyPositions: { x: number; y: number }[];
  stageWidth: number;
  stageHeight: number;
  /** v14: tree stealth — 0-1 fill progress toward the 3s hide threshold. */
  hideProgress: number;
  /** v14: true once fully hidden (enemies can't detect the player). */
  isHidden: boolean;
  /** v24: boss stages only — undefined once the boss is dead/not a boss stage. */
  bossHp?: number;
  bossMaxHp?: number;
}

export class HUDScene extends Phaser.Scene {
  private hpText!: Phaser.GameObjects.Text;
  private ammoText!: Phaser.GameObjects.Text;
  private killsText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private reloadText!: Phaser.GameObjects.Text;
  private outOfAmmoText!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private shieldBar!: Phaser.GameObjects.Graphics;
  private reloadBar!: Phaser.GameObjects.Graphics;
  private miniMap!: Phaser.GameObjects.Graphics;
  private lastMiniMapUpdate = 0;
  /** v9 #6: shrinks the minimap and text so nothing creeps into the bottom
   *  corners where the mobile move/aim joysticks + fire button live. */
  private isMobile = false;
  /** v13: farm stage's 5s "get ready" countdown + per-wave banner. */
  private farmCountdownText!: Phaser.GameObjects.Text;
  private farmWaveBannerText!: Phaser.GameObjects.Text;
  /** v14: tree stealth hide-progress bar + "HIDDEN" label. */
  private hideBar!: Phaser.GameObjects.Graphics;
  private hideText!: Phaser.GameObjects.Text;
  /** v24: big top-of-screen boss hp bar — only ever visible on boss stages. */
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossHpText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "HUDScene" });
  }

  private isPvp = false;
  private isJoystickScheme = false;

  create() {
    const { width, height } = this.scale;
    this.isMobile = Boolean(this.registry.get("isMobile"));
    this.isPvp = Boolean(this.registry.get("pvpMatchId"));
    this.isJoystickScheme = this.registry.get("mobileControlScheme") !== "split";

    this.hpBar = this.add.graphics();
    this.shieldBar = this.add.graphics();
    this.miniMap = this.add.graphics().setDepth(30);

    this.hpText = this.add.text(12, 10, "HP: 100/100", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#ffffff",
    });

    this.ammoText = this.add.text(12, 30, "AMMO: 12/36", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#f39c12",
    });

    this.reloadText = this.add.text(width / 2, 66, "RELOADING...", {
      fontFamily: "Orbitron, monospace",
      fontSize: "16px",
      color: "#c0392b",
    }).setOrigin(0.5).setVisible(false);

    this.reloadBar = this.add.graphics();

    // v8 #6: shown instead of an endless reload attempt once both the magazine
    // and the reserve daily ammo are empty — stays up until a refill succeeds
    // (ad/diamond, see AmmoRefillScene) or the stage ends.
    this.outOfAmmoText = this.add.text(width / 2, 66, "OUT OF AMMO", {
      fontFamily: "Orbitron, monospace",
      fontSize: "18px",
      color: "#ff3333",
      fontStyle: "bold",
    }).setOrigin(0.5).setVisible(false);

    this.waveText = this.add.text(width / 2, 12, "", {
      fontFamily: "Orbitron, monospace",
      fontSize: "14px",
      color: "#4ade80",
    }).setOrigin(0.5, 0);

    this.killsText = this.add.text(width - 10, 10, "KILLS: 0", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#ffffff",
    }).setOrigin(1, 0);

    this.scoreText = this.add.text(width - 10, 28, "SCORE: 0", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#f39c12",
    }).setOrigin(1, 0);

    // PvP has no pause (would desync the live match against the opponent) and
    // no daily-ammo economy, so neither button applies there.
    if (!this.isPvp) {
      this.createPauseButton(width);
      this.createRefillButton(width);
    }
    this.createReloadButton(width, height);

    this.farmCountdownText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "Orbitron, monospace", fontSize: "56px", color: "#ffcc00", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(60).setVisible(false);

    this.farmWaveBannerText = this.add.text(width / 2, height / 2 - 70, "", {
      fontFamily: "Orbitron, monospace", fontSize: "26px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(60).setVisible(false);

    // v24: big boss hp bar, top-center — set once and left alone unless a
    // hud-update actually carries bossHp (see onHudUpdate), so it never shows
    // on non-boss stages.
    this.bossBar = this.add.graphics().setDepth(50);
    this.bossNameText = this.add.text(width / 2, 26, "BOSS", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#ff6b6b", fontStyle: "bold", letterSpacing: 2,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5).setDepth(51).setVisible(false);
    this.bossHpText = this.add.text(width / 2, 55, "", {
      fontFamily: "Orbitron, monospace", fontSize: "12px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(51).setVisible(false);

    this.hideBar = this.add.graphics().setDepth(40);
    this.hideText = this.add.text(width / 2, height - 46, "", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#7dd3fc", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(40).setVisible(false);

    const gameScene = this.scene.get(this.isPvp ? "PvpScene" : "GameScene");
    gameScene.events.on("hud-update", this.onHudUpdate, this);
    gameScene.events.on("farm-countdown", this.onFarmCountdown, this);
    gameScene.events.on("farm-wave-start", this.onFarmWaveStart, this);
  }

  /** v13: "GET READY: N" during the farm stage's opening 5s (no enemies yet). */
  private onFarmCountdown(secondsLeft: number) {
    if (secondsLeft <= 0) {
      this.farmCountdownText.setVisible(false);
      return;
    }
    this.farmCountdownText.setText(`GET READY: ${secondsLeft}`).setVisible(true);
  }

  /** v13: "WAVE N" banner shown briefly on every wave transition (not just the first). */
  private onFarmWaveStart(wave: number) {
    this.farmWaveBannerText.setText(`WAVE ${wave} STARTING`).setVisible(true);
    this.time.delayedCall(2000, () => this.farmWaveBannerText.setVisible(false));
  }

  private createPauseButton(width: number) {
    const btn = this.add.text(width - 10, 50, "⏸ PAUSE", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#c5a97d",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    btn.on("pointerdown", () => {
      sfx.play("ui_click");
      const gameScene = this.scene.get("GameScene") as Phaser.Scene & { pauseGame: () => void };
      gameScene.pauseGame();
    });
    btn.on("pointerover", () => btn.setColor("#f3c98a"));
    btn.on("pointerout", () => btn.setColor("#c5a97d"));
  }

  /** v7 #3: refill ammo mid-stage without leaving to the Character/Weapon page. */
  private createRefillButton(width: number) {
    const btn = this.add.text(width - 10, 88, "⛽ REFILL", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#c5a97d",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    btn.on("pointerdown", () => {
      sfx.play("ui_click");
      const gameScene = this.scene.get("GameScene") as Phaser.Scene & { openAmmoRefill: () => void };
      gameScene.openAmmoRefill();
    });
    btn.on("pointerover", () => btn.setColor("#f3c98a"));
    btn.on("pointerout", () => btn.setColor("#c5a97d"));
  }

  /** v15: on-screen reload button — same effect as the R key, for players who
   *  don't have (or don't notice) the keyboard shortcut, and for mobile where
   *  there's no keyboard at all.
   *  v16: desktop also has right-click-to-reload now (see GameScene.ts), so
   *  this button is mainly for mobile — plain "Reload" text instead of an
   *  emoji icon, per request.
   *  v20/v24: mobile's "joystick" control scheme has a fire stick sitting in
   *  the bottom-right corner (see MobileControls.ts), so the reload button
   *  moves up to sit just above it there. The "split" scheme (tap anywhere on
   *  the right half to aim/fire) has no bottom-right widget at all, so this
   *  stays in the plain corner position, same as desktop. */
  private createReloadButton(width: number, height: number) {
    const radius = 30;
    const raised = this.isMobile && this.isJoystickScheme;
    // Fire stick: center (width-130, height-130), base radius 80 — its top
    // edge is at height-210. Leave a small gap above that for this button.
    const cx = raised ? width - 130 : width - 56;
    const cy = raised ? height - 210 - radius - 14 : height - 56;

    const circle = this.add.circle(cx, cy, radius, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xc5a97d)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });

    this.add.text(cx, cy, "Reload", {
      fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#c5a97d", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(21);

    circle.on("pointerdown", () => {
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.isPvp ? "PvpScene" : "GameScene") as Phaser.Scene & { triggerReload: () => void };
      gameScene.triggerReload();
    });
    circle.on("pointerover", () => circle.setStrokeStyle(2, 0xf3c98a));
    circle.on("pointerout", () => circle.setStrokeStyle(2, 0xc5a97d));
  }

  private onHudUpdate(data: HudUpdatePayload) {
    this.hpText.setText(`HP: ${Math.ceil(data.hp)}/${data.maxHp}`);
    this.ammoText.setText(`AMMO: ${data.magazine}/${data.magazineSize} (${data.ammo} left today)`);
    this.killsText.setText(`KILLS: ${data.kills}`);
    this.scoreText.setText(`SCORE: ${data.score}`);
    // v25: boss stages get the big top-center boss name/hp bar instead — the
    // plain "ELIMINATE ALL ENEMIES" objective line used to render at the same
    // y=12 spot and visually collide with "BOSS" right underneath it.
    const isBossStage = data.bossHp !== undefined && data.bossMaxHp !== undefined;
    this.waveText.setText(
      isBossStage ? "" : this.isPvp ? "DEFEAT YOUR OPPONENT" : data.isFarmStage ? `WAVE ${data.wave}` : "ELIMINATE ALL ENEMIES"
    );
    this.reloadText.setVisible(data.isReloading && !data.outOfAmmo);
    this.outOfAmmoText.setVisible(data.outOfAmmo);

    this.updateBossBar(data);

    this.hpBar.clear();
    this.hpBar.fillStyle(0x1a1a2e, 0.7);
    this.hpBar.fillRect(10, 48, 200, 10);
    this.hpBar.fillStyle(0x2d5a27, 1);
    this.hpBar.fillRect(10, 48, (data.hp / data.maxHp) * 200, 10);

    // Shield sits just above the HP bar — its own thin gray bar, absorbed first
    // and never regenerating mid-stage (see Player.applyToShieldThenHp).
    this.shieldBar.clear();
    if (data.shieldMax > 0) {
      this.shieldBar.fillStyle(0x1a1a2e, 0.7);
      this.shieldBar.fillRect(10, 42, 200, 5);
      this.shieldBar.fillStyle(0x9ca3af, 1);
      this.shieldBar.fillRect(10, 42, (data.shield / data.shieldMax) * 200, 5);
    }

    this.updateMiniMap(data);

    this.reloadBar.clear();
    if (data.reloadProgress >= 0) {
      const { width } = this.scale;
      const barWidth = 160;
      const x = width / 2 - barWidth / 2;
      this.reloadBar.fillStyle(0x1a1a2e, 0.8);
      this.reloadBar.fillRect(x, 78, barWidth, 8);
      this.reloadBar.fillStyle(0xc0392b, 1);
      this.reloadBar.fillRect(x, 78, barWidth * data.reloadProgress, 8);
    }

    this.updateHideBar(data);
  }

  /** v24: big, unmissable hp bar for the boss itself — top-center, well above
   *  the player's own small hp bar, "to show its scale" (per request). Hidden
   *  whenever bossHp is undefined (every non-boss stage, and once the boss
   *  itself is dead). */
  private updateBossBar(data: HudUpdatePayload) {
    this.bossBar.clear();
    if (data.bossHp === undefined || data.bossMaxHp === undefined) {
      this.bossNameText.setVisible(false);
      this.bossHpText.setVisible(false);
      return;
    }

    const { width } = this.scale;
    const barWidth = Math.min(480, width - 60);
    const barHeight = 22;
    const x = width / 2 - barWidth / 2;
    const y = 44;
    const pct = Math.max(0, data.bossHp / data.bossMaxHp);

    this.bossBar.fillStyle(0x1a1a2e, 0.85);
    this.bossBar.fillRect(x - 3, y - 3, barWidth + 6, barHeight + 6);
    this.bossBar.lineStyle(2, 0xff6b6b, 0.9);
    this.bossBar.strokeRect(x - 3, y - 3, barWidth + 6, barHeight + 6);
    this.bossBar.fillStyle(0x2a0a08, 1);
    this.bossBar.fillRect(x, y, barWidth, barHeight);
    this.bossBar.fillStyle(0xc0392b, 1);
    this.bossBar.fillRect(x, y, barWidth * pct, barHeight);

    this.bossNameText.setVisible(true);
    this.bossHpText.setText(`${Math.ceil(data.bossHp).toLocaleString()} / ${data.bossMaxHp.toLocaleString()}`).setVisible(true);
  }

  /** v14: shown only while inside a tree's stealth radius and progressing
   *  (or fully) hidden — hidden entirely otherwise so it doesn't clutter the
   *  HUD during normal combat. */
  private updateHideBar(data: HudUpdatePayload) {
    this.hideBar.clear();
    if (data.hideProgress <= 0) {
      this.hideText.setVisible(false);
      return;
    }

    const { width, height } = this.scale;
    const barWidth = 160;
    const x = width / 2 - barWidth / 2;
    const y = height - 60;

    this.hideBar.fillStyle(0x1a1a2e, 0.8);
    this.hideBar.fillRect(x, y, barWidth, 8);
    this.hideBar.fillStyle(data.isHidden ? 0x38bdf8 : 0x7dd3fc, 1);
    this.hideBar.fillRect(x, y, barWidth * data.hideProgress, 8);

    this.hideText.setText(data.isHidden ? "HIDDEN" : "HIDING...").setVisible(true);
  }

  /** Simple dot-based minimap, top-left corner — throttled to ~120ms since it doesn't
   *  need to update every single frame like the rest of the HUD. */
  private updateMiniMap(data: HudUpdatePayload) {
    const now = this.time.now;
    if (now - this.lastMiniMapUpdate < 120) return;
    this.lastMiniMapUpdate = now;

    const mapX = 10;
    const mapY = 96;
    const mapW = this.isMobile ? 90 : 140;
    const mapH = this.isMobile ? 65 : 100;

    this.miniMap.clear();
    this.miniMap.fillStyle(0x000000, 0.5);
    this.miniMap.fillRect(mapX, mapY, mapW, mapH);
    this.miniMap.lineStyle(1, 0x4a4e69, 1);
    this.miniMap.strokeRect(mapX, mapY, mapW, mapH);

    if (data.stageWidth <= 0 || data.stageHeight <= 0) return;
    const scaleX = mapW / data.stageWidth;
    const scaleY = mapH / data.stageHeight;

    this.miniMap.fillStyle(0xff4444, 1);
    for (const e of data.enemyPositions) {
      this.miniMap.fillCircle(mapX + e.x * scaleX, mapY + e.y * scaleY, 2.5);
    }

    this.miniMap.fillStyle(0x4ade80, 1);
    this.miniMap.fillCircle(mapX + data.playerPos.x * scaleX, mapY + data.playerPos.y * scaleY, 3);
  }

  shutdown() {
    const gameScene = this.scene.get(this.isPvp ? "PvpScene" : "GameScene");
    if (gameScene) {
      gameScene.events.off("hud-update", this.onHudUpdate, this);
      gameScene.events.off("farm-countdown", this.onFarmCountdown, this);
      gameScene.events.off("farm-wave-start", this.onFarmWaveStart, this);
    }
  }
}
