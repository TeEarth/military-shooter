import Phaser from "phaser";
import { sfx } from "@/lib/sfx";

export class PvpOverScene extends Phaser.Scene {
  constructor() {
    super({ key: "PvpOverScene" });
  }

  create(data: { won: boolean; opponentUsername: string }) {
    const { width, height } = this.scale;

    sfx.play(data.won ? "victory" : "defeat");

    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);

    this.add.text(width / 2, height / 2 - 100, data.won ? "VICTORY!" : "DEFEATED", {
      fontFamily: "Orbitron, monospace",
      fontSize: "32px",
      color: data.won ? "#f39c12" : "#c0392b",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 55, `vs ${data.opponentUsername}`, {
      fontFamily: "Orbitron, monospace",
      fontSize: "14px",
      color: "#c5a97d",
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 10, data.won ? "+10 🎟️" : "+10 💎", {
      fontFamily: "Orbitron, monospace",
      fontSize: "16px",
      color: "#4ade80",
      fontStyle: "bold",
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 60, "[ HOME ]", {
      fontFamily: "Orbitron, monospace",
      fontSize: "20px",
      color: "#4a4e69",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        window.location.href = "/home";
      })
      .on("pointerover", function (this: Phaser.GameObjects.Text) { this.setColor("#c5a97d"); })
      .on("pointerout", function (this: Phaser.GameObjects.Text) { this.setColor("#4a4e69"); });
  }
}
