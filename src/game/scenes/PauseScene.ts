import Phaser from "phaser";
import { sfx } from "@/lib/sfx";

export class PauseScene extends Phaser.Scene {
  /** v49 fix: RESUME/EXIT used to hardcode "GameScene" — in Tutorial mode the
   *  actually-running scene is "TutorialScene", a separate key, so resuming
   *  from pause there resumed the wrong (never-paused, inactive) scene and
   *  left the real one stuck paused forever. Same class of bug as HUDScene's
   *  reload/swap/one-shot buttons (see its gameplaySceneKey). */
  private gameplaySceneKey = "GameScene";

  constructor() {
    super({ key: "PauseScene" });
  }

  create() {
    const { width, height } = this.scale;
    this.gameplaySceneKey = this.registry.get("stageId") === "tutorial" ? "TutorialScene" : "GameScene";

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.65).setDepth(100);
    overlay.setInteractive(); // swallow clicks behind the pause menu

    this.add.text(width / 2, height / 2 - 80, "PAUSED", {
      fontFamily: "Orbitron, monospace", fontSize: "28px", color: "#c5a97d",
    }).setOrigin(0.5).setDepth(101);

    this.makeButton(width / 2, height / 2 - 10, "RESUME", 0x2d5a27, () => this.resumeGame());
    this.makeButton(width / 2, height / 2 + 50, "EXIT TO HOME", 0x8b2020, () => this.exitToHome());

    this.input.keyboard!.once("keydown-ESC", () => this.resumeGame());
  }

  private makeButton(x: number, y: number, label: string, color: number, onClick: () => void) {
    const btnWidth = 220;
    const btnHeight = 44;
    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, color, 1).setDepth(101).setStrokeStyle(2, 0xc5a97d);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Orbitron, monospace", fontSize: "14px", color: "#ffffff",
    }).setOrigin(0.5).setDepth(102);

    bg.on("pointerdown", () => { sfx.play("ui_click"); onClick(); });
    bg.on("pointerover", () => { bg.setFillStyle(color, 0.8); });
    bg.on("pointerout", () => { bg.setFillStyle(color, 1); });

    return { bg, text };
  }

  private resumeGame() {
    this.scene.resume(this.gameplaySceneKey);
    this.scene.resume("HUDScene");
    this.scene.stop();
  }

  private exitToHome() {
    const gameScene = this.scene.get(this.gameplaySceneKey) as Phaser.Scene & { reportProgressOnExit: () => void };
    gameScene.reportProgressOnExit();

    const onExitToHome = this.registry.get("onExitToHome") as (() => void) | undefined;
    if (onExitToHome) onExitToHome();
  }
}
