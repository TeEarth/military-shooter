import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: "BootScene" });
  }

  preload() {
    this.load.setPath("/assets");
    // Load minimal assets needed for preload screen
    this.load.image("logo", "sprites/ui/logo.png");
  }

  create() {
    this.scene.start("PreloadScene");
  }
}
