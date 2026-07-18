import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { Enemy } from "@/game/entities/Enemy";
import type { EnemySpawn } from "@/types/enemy";
import type { WeaponRow } from "@/lib/google/weapon";
import { INTRO_STEPS } from "./tutorialIntroSteps";

/**
 * First-time Training Mode — a guided walkthrough (this file's INTRO_* code)
 * followed by a scripted, sequential hands-on tutorial (the STEP_* code
 * below, unchanged from before). Extends GameScene (not a parallel
 * reimplementation) so movement/shooting/reload/stealth/collision all reuse
 * the exact same, already-tested engine code; this class only adds the
 * guided-intro overlay and the step-gating state machine on top.
 *
 * Per-state MOVE/SHOOT/RELOAD/KILL_ENEMY/STEALTH/FREE_COMBAT progress is
 * checkpointed to the server (see /api/tutorial/progress) so quitting
 * mid-tutorial resumes at the same step next time. Resuming at MOVE (i.e.
 * never got past the very first hands-on step, including a brand new
 * account that hasn't started yet) replays the guided intro too; resuming at
 * any later step skips straight to hands-on.
 */
export type TutorialState = "MOVE" | "SHOOT" | "RELOAD" | "KILL_ENEMY" | "STEALTH" | "FREE_COMBAT" | "COMPLETE";
type TutorialStep = Exclude<TutorialState, "COMPLETE">;

const STEP_ORDER: TutorialStep[] = ["MOVE", "SHOOT", "RELOAD", "KILL_ENEMY", "STEALTH", "FREE_COMBAT"];

function isTutorialStep(value: unknown): value is TutorialStep {
  return typeof value === "string" && (STEP_ORDER as string[]).includes(value);
}

const TUTORIAL_TICKET_REWARD = 10;

interface TutorialStepHandler {
  onEnter(scene: TutorialScene): void;
  onUpdate(scene: TutorialScene, delta: number): void;
  onExit(scene: TutorialScene): void;
}

const PISTOL_WEAPON: WeaponRow = {
  id: "pistol", name: "Pistol", unlockType: "FREE", unlockValue: 0,
  priceCoin: 0, priceDiamond: 0, priceTicket: 0,
  damage: 1, fireRate: 1, fireMode: "single", projectileCount: 1,
  accuracy: 50, magazineSize: 8, reloadTime: 5, critChance: 0, critDamage: 0,
  dailyAmmo: 80, spreadDegrees: 3, explosionRadius: 0,
  sprite: "/assets/sprites/bullets/bullet_round.svg",
};

function makePistolEnemySpawn(x: number, y: number): EnemySpawn {
  return {
    id: "enemy_pistol", weaponId: "pistol", hp: 1, coinReward: 0, sprite: "/assets/sprites/enemy/enemy_pistol.svg", immobile: false,
    weapon: PISTOL_WEAPON, spawnX: x, spawnY: y,
  };
}

const MOVE_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Use the movement controls to walk forward", 1);
    scene.showArrowAt(scene.moveTarget.x, scene.moveTarget.y);
    scene.showTargetZone(scene.moveTarget.x, scene.moveTarget.y);
  },
  onUpdate(scene) {
    const dist = Phaser.Math.Distance.Between(scene.player.sprite.x, scene.player.sprite.y, scene.moveTarget.x, scene.moveTarget.y);
    if (dist <= scene.MOVE_TARGET_RADIUS) scene.completeStep("Mission Complete!");
  },
  onExit(scene) {
    scene.hideArrow();
    scene.hideTargetZone();
  },
};

const SHOOT_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Fire 1 shot", 2);
    scene.shotFiredThisStep = false;
  },
  onUpdate(scene) {
    if (scene.shotFiredThisStep) scene.completeStep("Mission Complete!");
  },
  onExit() {},
};

const RELOAD_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Press Reload to refill ammo", 3);
    scene.wasReloading = false;
  },
  onUpdate(scene) {
    if (scene.wasReloading && !scene.player.isReloading) scene.completeStep("Mission Complete!");
  },
  onExit() {},
};

const KILL_ENEMY_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Eliminate the enemy", 4);
    // Reuse the guided intro's demonstration enemy if it's still around
    // (the normal case) instead of spawning a second one — it was never
    // added to scene.enemies during the intro, so it's been sitting there
    // inert/uninteractive until now.
    if (scene.introEnemy) {
      scene.killEnemyTarget = scene.introEnemy;
      scene.enemies.push(scene.introEnemy);
      scene.introEnemy = null;
    } else {
      const spawn = makePistolEnemySpawn(scene.player.sprite.x + 400, scene.player.sprite.y - 60);
      scene.killEnemyTarget = new Enemy(scene, spawn.spawnX, spawn.spawnY, spawn, scene.enemyBullets, scene.enemyGroup, 1, 1, scene.failedAssetKeys);
      scene.enemies.push(scene.killEnemyTarget);
    }
  },
  onUpdate(scene) {
    if (scene.killEnemyTarget?.isDead) scene.completeStep("Mission Complete!");
  },
  onExit() {},
};

const STEALTH_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Walk behind the tree to hide", 5);
    scene.showArrowAt(scene.treePosition.x, scene.treePosition.y);
    scene.stealthEnemySpawned = false;
  },
  onUpdate(scene) {
    if (!scene.stealthEnemySpawned && scene.isHidden) {
      scene.stealthEnemySpawned = true;
      scene.hideArrow();
      scene.setInstruction("While hidden, enemies can't see you", 5);
      const spawn = makePistolEnemySpawn(scene.treePosition.x + 250, scene.treePosition.y - 150);
      scene.stealthEnemy = new Enemy(scene, spawn.spawnX, spawn.spawnY, spawn, scene.enemyBullets, scene.enemyGroup, 1, 1, scene.failedAssetKeys);
      scene.enemies.push(scene.stealthEnemy);
      // Auto-advance to FREE_COMBAT shortly after the demonstration enemy
      // appears — from here the player finishes the enemy however they like,
      // no more forced steps (per spec: "no more forcing after this point").
      scene.time.delayedCall(2500, () => { if (scene.currentState === "STEALTH") scene.completeStep(); });
    }
  },
  onExit(scene) {
    scene.hideArrow();
  },
};

const FREE_COMBAT_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Finish the enemy off however you like", 6);
  },
  onUpdate(scene) {
    if (scene.stealthEnemy?.isDead) scene.finishTutorial();
  },
  onExit() {},
};

const STEP_HANDLERS: Record<TutorialStep, TutorialStepHandler> = {
  MOVE: MOVE_STEP, SHOOT: SHOOT_STEP, RELOAD: RELOAD_STEP,
  KILL_ENEMY: KILL_ENEMY_STEP, STEALTH: STEALTH_STEP, FREE_COMBAT: FREE_COMBAT_STEP,
};

export class TutorialScene extends GameScene {
  currentState: TutorialState = "MOVE";
  moveTarget = new Phaser.Math.Vector2(0, 0);
  treePosition = new Phaser.Math.Vector2(0, 0);
  readonly MOVE_TARGET_RADIUS = 60;

  shotFiredThisStep = false;
  wasReloading = false;
  killEnemyTarget: Enemy | null = null;
  stealthEnemySpawned = false;
  stealthEnemy: Enemy | null = null;
  /** Guided intro's demonstration enemy — spawned inert (never added to
   *  scene.enemies, so no AI/collision effect) purely so STEP 2 of the intro
   *  has something real to point at. KILL_ENEMY_STEP "activates" it later by
   *  finally pushing it into scene.enemies, instead of spawning a second one. */
  introEnemy: Enemy | null = null;

  private instructionBox!: Phaser.GameObjects.Container;
  private instructionText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private arrow?: Phaser.GameObjects.Triangle;
  private arrowTween?: Phaser.Tweens.Tween;
  private targetZone?: Phaser.GameObjects.Arc;
  private targetZoneTween?: Phaser.Tweens.Tween;
  private congratsShown = false;

  // --- Guided intro state/UI ---
  /** -1 = not currently in the guided intro (either finished, skipped, or
   *  never started because this session resumed past MOVE). */
  private introStepIndex = -1;
  private introDim?: Phaser.GameObjects.Rectangle;
  private introWorldRing?: Phaser.GameObjects.Arc;
  private introScreenRing?: Phaser.GameObjects.Graphics;
  private introBox!: Phaser.GameObjects.Container;
  private introTitleText!: Phaser.GameObjects.Text;
  private introDescText!: Phaser.GameObjects.Text;
  private introProgressText!: Phaser.GameObjects.Text;
  private introNextBtn!: Phaser.GameObjects.Text;
  private introSkipBtn!: Phaser.GameObjects.Text;
  private introRingTween?: Phaser.Tweens.Tween;
  private skipConfirmGroup?: Phaser.GameObjects.GameObject[];

  constructor() {
    super({ key: "TutorialScene" });
  }

  create() {
    super.create();

    this.moveTarget.set(this.player.sprite.x + 300, this.player.sprite.y);
    const tree = this.treeCovers[0]?.sprite;
    this.treePosition.set(tree ? tree.x : this.player.sprite.x + 640, tree ? tree.y : this.player.sprite.y);

    // Persistent (not tied to any one step) so both the guided intro's
    // "shooting"/"reload" steps AND the hands-on SHOOT_STEP/RELOAD_STEP can
    // detect the same real player action without duplicating listeners.
    this.events.on("player-fired", () => { this.shotFiredThisStep = true; });

    this.buildInstructionUI();
    this.instructionBox.setVisible(false);

    const rawResumeStep = this.registry.get("tutorialStep");
    const resumeStep: TutorialStep = isTutorialStep(rawResumeStep) ? rawResumeStep : "MOVE";
    this.currentState = resumeStep;

    if (resumeStep === "MOVE") {
      this.spawnIntroEnemy();
      this.buildIntroUI();
      this.showIntroStep(0);
    } else {
      this.instructionBox.setVisible(true);
      STEP_HANDLERS[resumeStep].onEnter(this);
      this.refreshProgress();
    }
  }

  update(time: number, delta: number) {
    super.update(time, delta);

    // Tracked unconditionally (not just during the hands-on RELOAD_STEP) so
    // the guided intro's own "reload" step can detect a real reload too.
    if (this.player.isReloading) this.wasReloading = true;

    if (this.introStepIndex >= 0) {
      this.updateIntroHighlight();
      const step = INTRO_STEPS[this.introStepIndex];
      if (step.autoAdvanceIf?.(this)) this.introNext();
      return;
    }

    const step = this.currentState;
    if (!isTutorialStep(step)) return;
    STEP_HANDLERS[step].onUpdate(this, delta);
  }

  /** Tutorial controls its own pacing entirely — never end the "stage" via
   *  GameScene's normal all-enemies-dead check. */
  protected checkWinCondition() {}

  /** No permadeath/revive economy in the tutorial — just get back up. */
  protected handlePlayerDeath() {
    this.player.revive();
  }

  /** The tutorial checkpoints its own progress on every step transition (see
   *  completeStep()) — GameScene's normal exit-progress report (which posts
   *  to /api/game/complete, meaningless for a synthetic "tutorial" stageId)
   *  isn't needed here. */
  reportProgressOnExit() {}

  completeStep(banner?: string) {
    const step = this.currentState;
    if (!isTutorialStep(step)) return;
    if (banner) this.showBanner(banner);
    STEP_HANDLERS[step].onExit(this);
    const next = STEP_ORDER[STEP_ORDER.indexOf(step) + 1];
    this.currentState = next;
    this.checkpoint(next);
    STEP_HANDLERS[next].onEnter(this);
    this.refreshProgress();
  }

  finishTutorial() {
    if (this.congratsShown) return;
    this.congratsShown = true;
    this.currentState = "COMPLETE";
    this.instructionBox.setVisible(false);

    fetch("/api/tutorial/complete", { method: "POST" })
      .then((r) => r.json())
      .catch(() => ({ success: false }))
      .then(() => this.showCongrats());
  }

  private checkpoint(step: TutorialState) {
    fetch("/api/tutorial/progress", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    }).catch(() => {});
  }

  // --- Guided intro ---

  /** Spawned inert on purpose — never pushed to this.enemies, so GameScene's
   *  normal per-frame `enemy.update()` loop never touches it (no patrol, no
   *  shooting, no reacting to the player at all) until KILL_ENEMY_STEP
   *  "activates" it. A stray bullet during the intro simply has no effect on
   *  it (onBulletHitEnemy looks it up via `this.enemies.find(...)`, which
   *  won't find an enemy that was never added). */
  private spawnIntroEnemy() {
    const spawn = makePistolEnemySpawn(this.player.sprite.x + 500, this.player.sprite.y - 60);
    this.introEnemy = new Enemy(this, spawn.spawnX, spawn.spawnY, spawn, this.enemyBullets, this.enemyGroup, 1, 1, this.failedAssetKeys);
  }

  private buildIntroUI() {
    const { width, height } = this.cameras.main;

    this.introDim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55).setScrollFactor(0).setDepth(140);
    this.introWorldRing = this.add.circle(0, 0, 38, 0x000000, 0).setStrokeStyle(3, 0xf3c98a).setDepth(150).setVisible(false);
    this.introScreenRing = this.add.graphics().setScrollFactor(0).setDepth(150).setVisible(false);
    this.introRingTween = this.tweens.add({ targets: [this.introWorldRing, this.introScreenRing], alpha: 0.35, duration: 500, yoyo: true, repeat: -1 });

    const boxWidth = Math.min(520, width - 32);
    const bg = this.add.rectangle(0, 0, boxWidth, 150, 0x1a1a2e, 0.97).setStrokeStyle(2, 0xc5a97d);
    this.introTitleText = this.add.text(0, -56, "", {
      fontFamily: "Orbitron, monospace", fontSize: "15px", color: "#f3c98a", fontStyle: "bold",
    }).setOrigin(0.5);
    this.introDescText = this.add.text(0, -34, "", {
      fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#ffffff", align: "center", wordWrap: { width: boxWidth - 40 },
    }).setOrigin(0.5, 0);
    this.introProgressText = this.add.text(0, 50, "", {
      fontFamily: "Orbitron, monospace", fontSize: "9px", color: "#8a8a9a",
    }).setOrigin(0.5);
    this.introNextBtn = this.add.text(boxWidth / 2 - 70, 66, "[ NEXT ]", {
      fontFamily: "Orbitron, monospace", fontSize: "12px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.introSkipBtn = this.add.text(-boxWidth / 2 + 60, 66, "Skip Tutorial", {
      fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#c0392b",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.introBox = this.add.container(width / 2, height - 130, [
      bg, this.introTitleText, this.introDescText, this.introProgressText, this.introNextBtn, this.introSkipBtn,
    ]).setScrollFactor(0).setDepth(160);

    this.introNextBtn.on("pointerdown", () => this.introNext());
    this.introSkipBtn.on("pointerdown", () => this.showSkipConfirm());
  }

  private showIntroStep(index: number) {
    this.introStepIndex = index;
    const step = INTRO_STEPS[index];
    this.introTitleText.setText(step.title);
    this.introDescText.setText(step.getDescription(this));
    this.introProgressText.setText(`Tutorial Guide  ${index + 1}/${INTRO_STEPS.length}`);
    this.introNextBtn.setText(index === INTRO_STEPS.length - 1 ? "[ START TRAINING ]" : "[ NEXT ]");

    if (step.id === "shooting") this.shotFiredThisStep = false;
    if (step.id === "reload") this.wasReloading = false;
  }

  private introNext() {
    if (this.introStepIndex < 0) return;
    const nextIndex = this.introStepIndex + 1;
    if (nextIndex >= INTRO_STEPS.length) {
      this.endIntro();
      return;
    }
    this.showIntroStep(nextIndex);
  }

  private updateIntroHighlight() {
    if (this.introStepIndex < 0) return;
    const step = INTRO_STEPS[this.introStepIndex];
    const highlight = step.getHighlight(this);
    this.introWorldRing?.setVisible(false);
    this.introScreenRing?.setVisible(false);

    if (highlight.kind === "world" && this.introWorldRing) {
      const pos = highlight.getPos(this);
      this.introWorldRing.setPosition(pos.x, pos.y).setVisible(true);
    } else if (highlight.kind === "screen" && this.introScreenRing) {
      const rect = highlight.getRect(this);
      this.introScreenRing.clear();
      this.introScreenRing.lineStyle(3, 0xf3c98a, 1);
      this.introScreenRing.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 14);
      this.introScreenRing.setVisible(true);
    }
  }

  private endIntro() {
    this.introStepIndex = -1;
    this.introRingTween?.stop();
    this.introDim?.destroy();
    this.introWorldRing?.destroy();
    this.introScreenRing?.destroy();
    this.introBox?.destroy();

    this.instructionBox.setVisible(true);
    const step = this.currentState;
    if (isTutorialStep(step)) {
      STEP_HANDLERS[step].onEnter(this);
      this.refreshProgress();
    }
  }

  private showSkipConfirm() {
    if (this.skipConfirmGroup) return;
    const { width, height } = this.cameras.main;
    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setScrollFactor(0).setDepth(200);
    const box = this.add.rectangle(width / 2, height / 2, 320, 150, 0x1a1a2e, 1).setStrokeStyle(2, 0xc0392b).setScrollFactor(0).setDepth(201);
    const text = this.add.text(width / 2, height / 2 - 30, "Skip the tutorial guide?", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#ffffff", align: "center", wordWrap: { width: 280 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202);
    const yesBtn = this.add.text(width / 2 - 70, height / 2 + 30, "[ SKIP ]", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#c0392b", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive({ useHandCursor: true });
    const noBtn = this.add.text(width / 2 + 70, height / 2 + 30, "[ CANCEL ]", {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(202).setInteractive({ useHandCursor: true });

    this.skipConfirmGroup = [dim, box, text, yesBtn, noBtn];
    const closeConfirm = () => {
      this.skipConfirmGroup?.forEach((o) => o.destroy());
      this.skipConfirmGroup = undefined;
    };
    yesBtn.on("pointerdown", () => { closeConfirm(); this.endIntro(); });
    noBtn.on("pointerdown", closeConfirm);
  }

  // --- Hands-on UI (unchanged) ---

  private buildInstructionUI() {
    const { width } = this.cameras.main;
    const bg = this.add.rectangle(0, 0, width - 40, 56, 0x000000, 0.7).setStrokeStyle(1, 0xc5a97d);
    this.instructionText = this.add.text(0, -8, "", {
      fontFamily: "Orbitron, monospace", fontSize: "14px", color: "#f3c98a", fontStyle: "bold",
    }).setOrigin(0.5);
    this.progressText = this.add.text(0, 14, "", {
      fontFamily: "Orbitron, monospace", fontSize: "10px", color: "#8a8a9a",
    }).setOrigin(0.5);
    this.instructionBox = this.add.container(width / 2, 40, [bg, this.instructionText, this.progressText])
      .setScrollFactor(0).setDepth(200);
  }

  setInstruction(text: string, _stepNumber: number) {
    this.instructionText.setText(text);
  }

  private refreshProgress() {
    if (!isTutorialStep(this.currentState)) return;
    const idx = STEP_ORDER.indexOf(this.currentState);
    this.progressText.setText(`Tutorial ${idx + 1}/${STEP_ORDER.length}`);
  }

  private showBanner(text: string) {
    const { width, height } = this.cameras.main;
    const label = this.add.text(width / 2, height / 2 - 60, text, {
      fontFamily: "Orbitron, monospace", fontSize: "20px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
    this.tweens.add({ targets: label, alpha: 0, y: label.y - 20, duration: 1200, delay: 400, onComplete: () => label.destroy() });
  }

  showArrowAt(x: number, y: number) {
    this.hideArrow();
    this.arrow = this.add.triangle(x, y - 60, 0, 20, 20, 20, 10, 0, 0xf3c98a).setDepth(150);
    this.arrowTween = this.tweens.add({ targets: this.arrow, y: y - 40, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  }

  hideArrow() {
    this.arrowTween?.stop();
    this.arrow?.destroy();
    this.arrow = undefined;
  }

  showTargetZone(x: number, y: number) {
    this.hideTargetZone();
    this.targetZone = this.add.circle(x, y, this.MOVE_TARGET_RADIUS, 0x4ade80, 0.15).setStrokeStyle(2, 0x4ade80).setDepth(5);
    this.targetZoneTween = this.tweens.add({ targets: this.targetZone, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
  }

  hideTargetZone() {
    this.targetZoneTween?.stop();
    this.targetZone?.destroy();
    this.targetZone = undefined;
  }

  private showCongrats() {
    const { width, height } = this.cameras.main;
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75).setScrollFactor(0).setDepth(210);
    const title = this.add.text(width / 2, height / 2 - 40, "CONGRATULATIONS!", {
      fontFamily: "Orbitron, monospace", fontSize: "24px", color: "#f3c98a", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
    const sub = this.add.text(width / 2, height / 2, "You have completed the training.", {
      fontFamily: "Orbitron, monospace", fontSize: "14px", color: "#ffffff",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
    const reward = this.add.text(width / 2, height / 2 + 26, `+${TUTORIAL_TICKET_REWARD} Tickets`, {
      fontFamily: "Orbitron, monospace", fontSize: "16px", color: "#4ade80", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211);
    const btn = this.add.text(width / 2, height / 2 + 70, "[ CONTINUE ]", {
      fontFamily: "Orbitron, monospace", fontSize: "14px", color: "#2d5a27",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(211).setInteractive({ useHandCursor: true });

    btn.on("pointerdown", () => {
      const onExitToHome = this.registry.get("onExitToHome") as (() => void) | undefined;
      bg.destroy(); title.destroy(); sub.destroy(); reward.destroy(); btn.destroy();
      if (onExitToHome) onExitToHome();
    });
  }
}
