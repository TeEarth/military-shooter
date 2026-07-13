import Phaser from "phaser";
import { sfx } from "@/lib/sfx";

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameOverScene" });
  }

  create(data: { completed: boolean; kills: number; deaths: number; score: number; stageId: string; isFarmStage?: boolean; farmWaveReached?: number; killCoin?: number }) {
    const { width, height } = this.scale;

    sfx.play(data.completed ? "victory" : "defeat");

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

    const titleText = data.completed ? "MISSION COMPLETE!" : "MISSION FAILED";
    const titleColor = data.completed ? "#f39c12" : "#c0392b";

    this.add.text(width / 2, height / 2 - 120, titleText, {
      fontFamily: "Orbitron, monospace",
      fontSize: "32px",
      color: titleColor,
      fontStyle: "bold",
    }).setOrigin(0.5);

    // Farm stage results are about run progress (wave reached, coins pocketed
    // from kills this run), not the story-stage coin/exp reward summary — a
    // fresh farm attempt always starts back at wave 1, so "score" would just
    // be a meaningless one-off number here.
    const stats = data.isFarmStage
      ? [
          `HIGHEST WAVE: ${data.farmWaveReached ?? 0}`,
          `COINS EARNED: ${data.killCoin ?? 0}`,
        ]
      : [
          `KILLS: ${data.kills}`,
          `DEATHS: ${data.deaths}`,
          `SCORE: ${data.score}`,
        ];

    stats.forEach((stat, i) => {
      this.add.text(width / 2, height / 2 - 40 + i * 30, stat, {
        fontFamily: "Orbitron, monospace",
        fontSize: "18px",
        color: "#ffffff",
      }).setOrigin(0.5);
    });

    // v17: boss victories unlock the next Multiverse — call that out here
    // since the actual "go there" button lives back on the Play menu, not
    // this screen.
    if (data.completed && data.stageId.startsWith("boss_")) {
      this.add.text(width / 2, height / 2 + 50, "A new Multiverse has unlocked — check the Play menu!", {
        fontFamily: "Orbitron, monospace",
        fontSize: "13px",
        color: "#f3c98a",
      }).setOrigin(0.5);
    }

    // Retry only makes sense after a LOSS — a cleared story/boss stage can never be
    // replayed (see /api/game/start's isStageCompleted check), so offering Retry
    // after a win would let the client re-run a stage the server would reject
    // anyway (and would silently re-spend that attempt's ammo for nothing).
    if (!data.completed) {
      this.add.text(width / 2 - 80, height / 2 + 80, "[ RETRY ]", {
        fontFamily: "Orbitron, monospace",
        fontSize: "20px",
        color: "#2d5a27",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          // Re-fetch /api/game/start via React (not a bare Phaser scene restart) so
          // remaining daily ammo and any other server state are read fresh — a plain
          // scene restart would keep replaying the stale ammo/loadout snapshot from
          // the original registry data, letting the player retry for free forever.
          const onRetry = this.game.registry.get("onRetry") as (() => void) | undefined;
          onRetry?.();
        })
        .on("pointerover", function(this: Phaser.GameObjects.Text) { this.setColor("#f39c12"); })
        .on("pointerout", function(this: Phaser.GameObjects.Text) { this.setColor("#2d5a27"); });
    }

    // v24: cleared a regular story stage (not farm, not a boss encounter) —
    // offer a direct "NEXT STAGE" instead of forcing a trip back through the
    // Home menu every single time. Stage ids are always "stageNN", so the
    // next one is just that number +1 — if it turns out to be locked (e.g.
    // the next multiverse needs its boss cleared first), /game's own existing
    // "not unlocked" handling takes over exactly like navigating there any
    // other way would.
    const isBossStage = data.stageId.startsWith("boss_");
    const nextStageMatch = data.stageId.match(/^stage(\d+)$/);
    const showNext = data.completed && !data.isFarmStage && !isBossStage && nextStageMatch !== null;
    const nextStageId = nextStageMatch ? `stage${String(Number(nextStageMatch[1]) + 1).padStart(2, "0")}` : null;

    if (showNext && nextStageId) {
      this.add.text(width / 2 - 90, height / 2 + 80, "[ NEXT STAGE ]", {
        fontFamily: "Orbitron, monospace",
        fontSize: "20px",
        color: "#2d5a27",
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          window.location.href = `/game?stage=${nextStageId}`;
        })
        .on("pointerover", function(this: Phaser.GameObjects.Text) { this.setColor("#f39c12"); })
        .on("pointerout", function(this: Phaser.GameObjects.Text) { this.setColor("#2d5a27"); });
    }

    // Home button
    this.add.text(showNext ? width / 2 + 90 : data.completed ? width / 2 : width / 2 + 80, height / 2 + 80, "[ HOME ]", {
      fontFamily: "Orbitron, monospace",
      fontSize: "20px",
      color: "#4a4e69",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        window.location.href = "/home";
      })
      .on("pointerover", function(this: Phaser.GameObjects.Text) { this.setColor("#c5a97d"); })
      .on("pointerout", function(this: Phaser.GameObjects.Text) { this.setColor("#4a4e69"); });
  }
}
