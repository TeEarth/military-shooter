import Phaser from "phaser";
import { GameScene } from "./GameScene";
import { Enemy } from "@/game/entities/Enemy";
import type { EnemySpawn } from "@/types/enemy";
import type { WeaponRow } from "@/lib/google/weapon";

/**
 * First-time Training Mode — a scripted, sequential tutorial. Extends
 * GameScene (not a parallel reimplementation) so movement/shooting/reload/
 * stealth/collision all reuse the exact same, already-tested engine code;
 * this class only adds the step-gating state machine and its UI on top.
 *
 * Per-state MOVE/SHOOT/RELOAD/KILL_ENEMY/STEALTH/FREE_COMBAT progress is
 * checkpointed to the server (see /api/tutorial/progress) so quitting
 * mid-tutorial resumes at the same step next time, per spec.
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
    scene.events.once("player-fired", () => { scene.shotFiredThisStep = true; });
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
    if (scene.player.isReloading) scene.wasReloading = true;
    else if (scene.wasReloading) scene.completeStep("Mission Complete!");
  },
  onExit() {},
};

const KILL_ENEMY_STEP: TutorialStepHandler = {
  onEnter(scene) {
    scene.setInstruction("Eliminate the enemy", 4);
    const spawn: EnemySpawn = {
      id: "tutorial_enemy_1", weaponId: "pistol", hp: 1, coinReward: 0, sprite: "", immobile: false,
      weapon: PISTOL_WEAPON, spawnX: scene.player.sprite.x + 400, spawnY: scene.player.sprite.y - 60,
    };
    scene.killEnemyTarget = new Enemy(scene, spawn.spawnX, spawn.spawnY, spawn, scene.enemyBullets, scene.enemyGroup, 1, 1, scene.failedAssetKeys);
    scene.enemies.push(scene.killEnemyTarget);
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
      const spawn: EnemySpawn = {
        id: "tutorial_enemy_2", weaponId: "pistol", hp: 1, coinReward: 0, sprite: "", immobile: false,
        weapon: PISTOL_WEAPON, spawnX: scene.treePosition.x + 250, spawnY: scene.treePosition.y - 150,
      };
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

  private instructionBox!: Phaser.GameObjects.Container;
  private instructionText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private arrow?: Phaser.GameObjects.Triangle;
  private arrowTween?: Phaser.Tweens.Tween;
  private targetZone?: Phaser.GameObjects.Arc;
  private targetZoneTween?: Phaser.Tweens.Tween;
  private congratsShown = false;

  constructor() {
    super({ key: "TutorialScene" });
  }

  create() {
    super.create();

    this.moveTarget.set(this.player.sprite.x + 300, this.player.sprite.y);
    const tree = this.treeCovers[0]?.sprite;
    this.treePosition.set(tree ? tree.x : this.player.sprite.x + 640, tree ? tree.y : this.player.sprite.y);

    this.buildInstructionUI();

    const rawResumeStep = this.registry.get("tutorialStep");
    const resumeStep: TutorialStep = isTutorialStep(rawResumeStep) ? rawResumeStep : "MOVE";
    this.currentState = resumeStep;
    STEP_HANDLERS[resumeStep].onEnter(this);
    this.refreshProgress();
  }

  update(time: number, delta: number) {
    super.update(time, delta);
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

  // --- UI ---

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
