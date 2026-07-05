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

  constructor() {
    super({ key: "HUDScene" });
  }

  create() {
    const { width } = this.scale;
    this.isMobile = Boolean(this.registry.get("isMobile"));

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

    this.createPauseButton(width);
    this.createRefillButton(width);

    const gameScene = this.scene.get("GameScene");
    gameScene.events.on("hud-update", this.onHudUpdate, this);
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

  private onHudUpdate(data: HudUpdatePayload) {
    this.hpText.setText(`HP: ${Math.ceil(data.hp)}/${data.maxHp}`);
    this.ammoText.setText(`AMMO: ${data.magazine}/${data.magazineSize} (${data.ammo} left today)`);
    this.killsText.setText(`KILLS: ${data.kills}`);
    this.scoreText.setText(`SCORE: ${data.score}`);
    this.waveText.setText(data.isFarmStage ? `WAVE ${data.wave}` : "ELIMINATE ALL ENEMIES");
    this.reloadText.setVisible(data.isReloading && !data.outOfAmmo);
    this.outOfAmmoText.setVisible(data.outOfAmmo);

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
    const gameScene = this.scene.get("GameScene");
    if (gameScene) gameScene.events.off("hud-update", this.onHudUpdate, this);
  }
}
