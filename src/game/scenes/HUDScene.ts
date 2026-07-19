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
  /** v35: seconds left in the current reload, or -1 when not reloading. */
  reloadSecondsRemaining: number;
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
  /** v35: perk system (single-player only — never set by PvpScene) — see
   *  src/lib/perks.ts for the catalog. */
  perks?: { spareWeapon: boolean; regen: boolean; superShield: boolean; oneShot: boolean; invisible: boolean; neverDied: boolean };
  /** v35: -1 if the Spare Weapon perk/slot isn't set up at all. */
  swapCooldownRemaining?: number;
  /** v35: -1 if that perk isn't owned. */
  regenCooldownRemaining?: number;
  shieldCooldownRemaining?: number;
  /** v36: -1 unless shield is currently counting down toward a trigger. */
  shieldChargeRemaining?: number;
  oneShotCooldownRemaining?: number;
  oneShotArmed?: boolean;
  /** v50: -1 if the Invisible perk isn't owned. */
  invisibleCooldownRemaining?: number;
  invisibleActive?: boolean;
  /** v50: true once the once-per-match Never Died save has already fired. */
  neverDiedUsed?: boolean;
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
  private neverDiedBannerText!: Phaser.GameObjects.Text;
  /** v14: tree stealth hide-progress bar + "HIDDEN" label. */
  private hideBar!: Phaser.GameObjects.Graphics;
  private hideText!: Phaser.GameObjects.Text;
  /** v24: big top-of-screen boss hp bar — only ever visible on boss stages. */
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossNameText!: Phaser.GameObjects.Text;
  /** v35: perk buttons/status icons — only ever created (non-undefined) when
   *  the matching perk is owned, see create()'s perk block. */
  private swapCircle?: Phaser.GameObjects.Arc;
  private swapText?: Phaser.GameObjects.Text;
  private oneShotCircle?: Phaser.GameObjects.Arc;
  private oneShotText?: Phaser.GameObjects.Text;
  private regenIcon?: Phaser.GameObjects.Text;
  private regenImg?: Phaser.GameObjects.Image;
  private regenCooldownText?: Phaser.GameObjects.Text;
  private shieldIcon?: Phaser.GameObjects.Text;
  private shieldImg?: Phaser.GameObjects.Image;
  private shieldCooldownText?: Phaser.GameObjects.Text;
  /** v50: Invisible/Never Died status icons — same "created only if owned" rule. */
  private invisibleIcon?: Phaser.GameObjects.Text;
  private invisibleImg?: Phaser.GameObjects.Image;
  private invisibleCooldownText?: Phaser.GameObjects.Text;
  private neverDiedIcon?: Phaser.GameObjects.Text;
  private neverDiedImg?: Phaser.GameObjects.Image;
  private neverDiedStatusText?: Phaser.GameObjects.Text;
  private bossHpText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "HUDScene" });
  }

  private isPvp = false;
  private isTutorial = false;
  private isJoystickScheme = false;

  /** v49 fix: every button handler used to hardcode "GameScene" for the
   *  non-PvP case, so Tutorial mode (a separate "TutorialScene") silently
   *  called methods on an inactive, never-created GameScene instance whose
   *  update() loop never runs — this is exactly why the on-screen RELOAD
   *  button (mobile's only way to reload, no physical R key) did nothing at
   *  all in Tutorial mode. */
  private get gameplaySceneKey(): string {
    if (this.isPvp) return "PvpScene";
    if (this.isTutorial) return "TutorialScene";
    return "GameScene";
  }

  create() {
    const { width, height } = this.scale;
    this.isMobile = Boolean(this.registry.get("isMobile"));
    this.isPvp = Boolean(this.registry.get("pvpMatchId"));
    this.isTutorial = this.registry.get("stageId") === "tutorial";
    this.isJoystickScheme = this.registry.get("mobileControlScheme") !== "split";

    // v41: HUD buttons (Reload/Swap/One Shot/Pause/Refill/Exit) live on a
    // separate scene from GameScene/PvpScene's shoot detection, which reads
    // raw pointer state (activePointer.leftButtonDown()) — clicking/tapping a
    // button was ALSO read as "mouse button is down" by the scene underneath,
    // firing a real shot (and, for One Shot, wasting the perk instantly). Every
    // button below calls claimPointer() on pointerdown; GameScene/PvpScene
    // skip shoot input for whichever pointer id is currently claimed here.
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      if (this.registry.get("uiPointerId") === p.id) this.registry.set("uiPointerId", -1);
    });
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) => {
      if (this.registry.get("uiPointerId") === p.id) this.registry.set("uiPointerId", -1);
    });

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
    // no daily-ammo economy, so neither button applies there — an EXIT button
    // takes the exact same slot instead (see v25's createExitButton, styled
    // identically to createPauseButton per the user's request to match it).
    if (!this.isPvp) {
      this.createPauseButton(width);
      this.createRefillButton(width);
    } else {
      this.createExitButton(width);
    }
    this.createReloadButton(width, height);

    // v41: perks now work identically in PvP (see PvpScene.ts's
    // triggerSwapWeapon()/triggerOneShot() and the perks/spareLoadout it now
    // reads from the match-start payload) — render the same buttons/icons
    // there too, not just single-player.
    {
      const perks = this.registry.get("perks") as { spareWeapon: boolean; regen: boolean; superShield: boolean; oneShot: boolean; invisible: boolean; neverDied: boolean } | undefined;
      let stackedAbove = 0;
      if (perks?.spareWeapon) {
        this.createSwapButton(width, height, stackedAbove);
        stackedAbove++;
      }
      if (perks?.oneShot) {
        this.createOneShotButton(width, height, stackedAbove);
      }
      if (perks?.regen || perks?.superShield || perks?.invisible || perks?.neverDied) {
        this.createPerkStatusIcons(width, Boolean(perks?.regen), Boolean(perks?.superShield), Boolean(perks?.invisible), Boolean(perks?.neverDied));
      }
    }

    this.farmCountdownText = this.add.text(width / 2, height / 2, "", {
      fontFamily: "Orbitron, monospace", fontSize: "56px", color: "#ffcc00", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(60).setVisible(false);

    this.farmWaveBannerText = this.add.text(width / 2, height / 2 - 70, "", {
      fontFamily: "Orbitron, monospace", fontSize: "26px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(60).setVisible(false);

    // v52: Never Died save banner — big and unmissable, distinct from the
    // quiet tint-flash-only feedback it had before.
    this.neverDiedBannerText = this.add.text(width / 2, height / 2 - 100, "NEVER DIED ACTIVATED!", {
      fontFamily: "Orbitron, monospace", fontSize: "28px", color: "#f472b6", fontStyle: "bold",
    }).setOrigin(0.5).setDepth(65).setVisible(false);

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

    const gameScene = this.scene.get(this.gameplaySceneKey);
    gameScene.events.on("hud-update", this.onHudUpdate, this);
    gameScene.events.on("farm-countdown", this.onFarmCountdown, this);
    gameScene.events.on("farm-wave-start", this.onFarmWaveStart, this);
    gameScene.events.on("player-never-died", this.onNeverDiedActivated, this);
  }

  /** v52: shows the "NEVER DIED ACTIVATED!" banner for 2.5s the moment the
   *  perk actually triggers (see Player.ts's applyToShieldThenHp). */
  private onNeverDiedActivated() {
    this.neverDiedBannerText.setVisible(true).setAlpha(1);
    this.tweens.add({
      targets: this.neverDiedBannerText, alpha: 0, delay: 1800, duration: 700,
      onComplete: () => this.neverDiedBannerText.setVisible(false),
    });
  }

  /** v41: marks this pointer as "consumed by UI" for the rest of this touch/
   *  click — see the pointerup/pointerupoutside listeners in create(). */
  private claimPointer(pointer: Phaser.Input.Pointer) {
    this.registry.set("uiPointerId", pointer.id);
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

    btn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { pauseGame: () => void };
      gameScene.pauseGame();
    });
    btn.on("pointerover", () => btn.setColor("#f3c98a"));
    btn.on("pointerout", () => btn.setColor("#c5a97d"));
  }

  /** v25: PvP's equivalent of the PAUSE button above — same position/style,
   *  same font, same hover behavior, just labeled EXIT and forfeiting the
   *  match instead of pausing (PvP has no pause, see the isPvp branch in
   *  create()). Replaces the earlier plain DOM/React button, which didn't
   *  match the rest of the in-game HUD's look at all. */
  private createExitButton(width: number) {
    const btn = this.add.text(width - 10, 50, "✕ EXIT", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#c5a97d",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    btn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const pvpScene = this.scene.get("PvpScene") as Phaser.Scene & { exitMatch: () => void };
      pvpScene.exitMatch();
    });
    btn.on("pointerover", () => btn.setColor("#f3c98a"));
    btn.on("pointerout", () => btn.setColor("#c5a97d"));
  }

  /** v7 #3: refill ammo mid-stage without leaving to the Character/Weapon page.
   *  v61: bullet-cartridge icon instead of a gas-pump emoji, per request. */
  private createRefillButton(width: number) {
    const btn = this.add.text(width - 10, 88, "REFILL", {
      fontFamily: "Orbitron, monospace",
      fontSize: "12px",
      color: "#c5a97d",
      backgroundColor: "#1a1a2e",
      padding: { x: 8, y: 4 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    this.add.image(width - 10 - btn.width - 4, 88 + 13, "icon_ammo").setOrigin(1, 0.5).setDisplaySize(16, 16);

    btn.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { openAmmoRefill: () => void };
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

    circle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { triggerReload: () => void };
      gameScene.triggerReload();
    });
    circle.on("pointerover", () => circle.setStrokeStyle(2, 0xf3c98a));
    circle.on("pointerout", () => circle.setStrokeStyle(2, 0xc5a97d));
  }

  /** Shared position math for a button stacked directly above the Reload
   *  button — stackIndex 0 sits immediately above it, 1 sits above that, etc. */
  private stackedButtonPosition(width: number, height: number, stackIndex: number) {
    const radius = 30;
    const raised = this.isMobile && this.isJoystickScheme;
    const cx = raised ? width - 130 : width - 56;
    const reloadCy = raised ? height - 210 - radius - 14 : height - 56;
    const cy = reloadCy - (stackIndex + 1) * (radius * 2 + 14);
    return { cx, cy, radius };
  }

  /** v35: Spare Weapon perk — SWAP button, same visual language as Reload,
   *  stacked directly above it. Label updates each hud-update with whichever
   *  weapon ISN'T currently active (the one you'd swap TO). */
  private createSwapButton(width: number, height: number, stackIndex: number) {
    const { cx, cy, radius } = this.stackedButtonPosition(width, height, stackIndex);
    this.swapCircle = this.add.circle(cx, cy, radius, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xc5a97d).setDepth(20).setInteractive({ useHandCursor: true });
    this.swapText = this.add.text(cx, cy, "SWAP", {
      fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#c5a97d", fontStyle: "bold", align: "center",
    }).setOrigin(0.5).setDepth(21);

    this.swapCircle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { triggerSwapWeapon: () => void };
      gameScene.triggerSwapWeapon();
    });
    this.swapCircle.on("pointerover", () => this.swapCircle?.setStrokeStyle(2, 0xf3c98a));
    this.swapCircle.on("pointerout", () => this.swapCircle?.setStrokeStyle(2, 0xc5a97d));
  }

  /** v35: One Shot perk — skull button, stacked above Swap (or directly
   *  above Reload if Spare Weapon isn't owned). Glows gold while armed. */
  private createOneShotButton(width: number, height: number, stackIndex: number) {
    const { cx, cy, radius } = this.stackedButtonPosition(width, height, stackIndex);
    this.oneShotCircle = this.add.circle(cx, cy, radius, 0x1a1a2e, 0.85)
      .setStrokeStyle(2, 0xc5a97d).setDepth(20).setInteractive({ useHandCursor: true });
    this.oneShotText = this.add.text(cx, cy, "💀", { fontSize: "20px" }).setOrigin(0.5).setDepth(21);

    this.oneShotCircle.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.claimPointer(pointer);
      sfx.play("ui_click");
      const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { triggerOneShot: () => void };
      gameScene.triggerOneShot();
    });
    this.oneShotCircle.on("pointerover", () => { if (this.oneShotCircle?.getData("ready")) this.oneShotCircle.setStrokeStyle(2, 0xf3c98a); });
    this.oneShotCircle.on("pointerout", () => { if (this.oneShotCircle?.getData("ready")) this.oneShotCircle.setStrokeStyle(2, 0xc5a97d); });
  }

  /** v35: Regeneration / Super Shield perk status icons, below the ammo
   *  Refill button (top-right) — ready (bright) vs on-cooldown (dim, with a
   *  countdown). Purely informational, no click handler. */
  private createPerkStatusIcons(width: number, hasRegen: boolean, hasShield: boolean, hasInvisible: boolean, hasNeverDied: boolean) {
    // v61: real icon Images (matching the Character page's Icon component
    // designs) instead of default-emoji glyphs baked into the label text —
    // each icon sits just left of its label, right-edge-anchored the same
    // way the label itself always was, so nothing overflows on narrow screens.
    let y = 118;
    if (hasRegen) {
      this.regenIcon = this.add.text(width - 10, y, "REGEN", {
        fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#4ade80",
      }).setOrigin(1, 0);
      this.regenImg = this.add.image(width - 10 - this.regenIcon.width - 4, y + 6, "icon_regen").setOrigin(1, 0.5).setDisplaySize(14, 14);
      this.regenCooldownText = this.add.text(width - 10, y + 13, "", {
        fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#94a3b8",
      }).setOrigin(1, 0);
      y += 34;
    }
    if (hasShield) {
      this.shieldIcon = this.add.text(width - 10, y, "SHIELD", {
        fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#60a5fa",
      }).setOrigin(1, 0);
      this.shieldImg = this.add.image(width - 10 - this.shieldIcon.width - 4, y + 6, "icon_shield").setOrigin(1, 0.5).setDisplaySize(14, 14);
      this.shieldCooldownText = this.add.text(width - 10, y + 13, "", {
        fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#94a3b8",
      }).setOrigin(1, 0);
      y += 34;
    }
    if (hasInvisible) {
      this.invisibleIcon = this.add.text(width - 10, y, "INVISIBLE", {
        fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#a78bfa",
      }).setOrigin(1, 0);
      this.invisibleImg = this.add.image(width - 10 - this.invisibleIcon.width - 4, y + 6, "icon_invisible").setOrigin(1, 0.5).setDisplaySize(14, 14);
      this.invisibleCooldownText = this.add.text(width - 10, y + 13, "", {
        fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#94a3b8",
      }).setOrigin(1, 0);
      y += 34;
    }
    if (hasNeverDied) {
      this.neverDiedIcon = this.add.text(width - 10, y, "NEVER DIED", {
        fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#f472b6",
      }).setOrigin(1, 0);
      this.neverDiedImg = this.add.image(width - 10 - this.neverDiedIcon.width - 4, y + 6, "icon_neverdied").setOrigin(1, 0.5).setDisplaySize(14, 14);
      this.neverDiedStatusText = this.add.text(width - 10, y + 13, "READY", {
        fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#94a3b8",
      }).setOrigin(1, 0);
    }
  }

  /** v35: shared "ready (bright) vs on-cooldown (dim + countdown)" look for
   *  the perk status icons/buttons — cooldownRemaining is in seconds, -1
   *  meaning the perk isn't owned (handled by the caller not calling this). */
  private applyPerkCooldownVisual(icon: Phaser.GameObjects.Text | undefined, cooldownText: Phaser.GameObjects.Text | undefined, cooldownRemaining: number, readyColor: string, img?: Phaser.GameObjects.Image) {
    if (!icon) return;
    const ready = cooldownRemaining <= 0;
    icon.setAlpha(ready ? 1 : 0.4);
    icon.setColor(ready ? readyColor : "#94a3b8");
    img?.setAlpha(ready ? 1 : 0.4);
    cooldownText?.setText(ready ? "READY" : `${cooldownRemaining.toFixed(0)}s`);
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
    if (data.isReloading && data.reloadSecondsRemaining >= 0) {
      this.reloadText.setText(`RELOADING... ${data.reloadSecondsRemaining.toFixed(1)}s`);
    }
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
    this.updatePerkUi(data);
  }

  /** v35: swap/one-shot buttons + regen/shield status icons — no-ops for any
   *  element that was never created (perk not owned, see create()). */
  private updatePerkUi(data: HudUpdatePayload) {
    if (this.swapCircle && this.swapText) {
      const remaining = data.swapCooldownRemaining ?? -1;
      const ready = remaining <= 0;
      this.swapCircle.setStrokeStyle(2, ready ? 0xc5a97d : 0x555555).setAlpha(ready ? 1 : 0.5);
      // v36: no weapon name — it overflowed past the button's edge. The name
      // is still shown on the Character/Inventory pages; in-stage this is
      // just a quick "can I swap right now" glance.
      this.swapText.setText(ready ? "SWAP" : `${remaining.toFixed(0)}s`);
    }

    if (this.oneShotCircle && this.oneShotText) {
      const remaining = data.oneShotCooldownRemaining ?? -1;
      const ready = remaining <= 0;
      const armed = Boolean(data.oneShotArmed);
      this.oneShotCircle.setData("ready", ready);
      if (armed) {
        this.oneShotCircle.setStrokeStyle(3, 0xf39c12).setFillStyle(0x3a2a0a, 0.9);
      } else {
        this.oneShotCircle.setStrokeStyle(2, ready ? 0xc5a97d : 0x555555).setFillStyle(0x1a1a2e, 0.85);
      }
      this.oneShotCircle.setAlpha(ready || armed ? 1 : 0.5);
      this.oneShotText.setText(ready || armed ? "💀" : `${remaining.toFixed(0)}s`);
    }

    this.applyPerkCooldownVisual(this.regenIcon, this.regenCooldownText, data.regenCooldownRemaining ?? -1, "#4ade80", this.regenImg);

    // v36: Super Shield has a third state Regen doesn't — the 15s "arming"
    // countdown while shield sits empty, distinct from the 60s cooldown
    // after it actually fires. Shown in amber so it reads as "something is
    // building up", not confused with either the green ready or dim/gray states.
    if (this.shieldIcon) {
      const cooldown = data.shieldCooldownRemaining ?? -1;
      const charging = data.shieldChargeRemaining ?? -1;
      if (charging > 0) {
        this.shieldIcon.setAlpha(1).setColor("#f59e0b");
        this.shieldImg?.setAlpha(1);
        this.shieldCooldownText?.setText(`ARMING ${charging.toFixed(0)}s`);
      } else {
        this.applyPerkCooldownVisual(this.shieldIcon, this.shieldCooldownText, cooldown, "#60a5fa", this.shieldImg);
      }
    }

    // v50: Invisible has a third state Regen/Shield don't — ACTIVE (the 2s
    // window itself), distinct from both ready and on-cooldown.
    if (this.invisibleIcon) {
      if (data.invisibleActive) {
        this.invisibleIcon.setAlpha(1).setColor("#c4b5fd");
        this.invisibleImg?.setAlpha(1);
        this.invisibleCooldownText?.setText("ACTIVE");
      } else {
        this.applyPerkCooldownVisual(this.invisibleIcon, this.invisibleCooldownText, data.invisibleCooldownRemaining ?? -1, "#a78bfa", this.invisibleImg);
      }
    }

    if (this.neverDiedIcon) {
      const used = Boolean(data.neverDiedUsed);
      this.neverDiedIcon.setAlpha(used ? 0.4 : 1).setColor(used ? "#94a3b8" : "#f472b6");
      this.neverDiedImg?.setAlpha(used ? 0.4 : 1);
      this.neverDiedStatusText?.setText(used ? "USED" : "READY").setColor(used ? "#94a3b8" : "#4ade80");
    }
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
    const gameScene = this.scene.get(this.gameplaySceneKey);
    if (gameScene) {
      gameScene.events.off("hud-update", this.onHudUpdate, this);
      gameScene.events.off("farm-countdown", this.onFarmCountdown, this);
      gameScene.events.off("farm-wave-start", this.onFarmWaveStart, this);
      gameScene.events.off("player-never-died", this.onNeverDiedActivated, this);
    }
  }
}
