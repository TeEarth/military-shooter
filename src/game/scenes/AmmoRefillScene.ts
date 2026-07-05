import Phaser from "phaser";
import { sfx } from "@/lib/sfx";
import { showRewardedAd } from "@/lib/ads-service";
import type { CombatLoadout } from "@/types/loadout";

/**
 * v7 #3: mid-stage ammo refill — reachable from a HUD button during actual
 * gameplay (not just the Pause menu), so the player never has to leave the
 * stage to top up. Launched as its own paused overlay scene, same pattern as
 * PauseScene (GameScene + HUDScene both paused underneath while this is up).
 */
export class AmmoRefillScene extends Phaser.Scene {
  private weaponId!: string;
  private statusText!: Phaser.GameObjects.Text;
  private busy = false;

  constructor() {
    super({ key: "AmmoRefillScene" });
  }

  create() {
    const { width, height } = this.scale;
    const loadout = this.registry.get("character") as CombatLoadout;
    this.weaponId = loadout.weaponId;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(100);
    overlay.setInteractive();

    this.add.text(width / 2, height / 2 - 80, "REFILL AMMO", {
      fontFamily: "Orbitron, monospace", fontSize: "22px", color: "#c5a97d",
    }).setOrigin(0.5).setDepth(101);

    this.statusText = this.add.text(width / 2, height / 2 - 45, "", {
      fontFamily: "Orbitron, monospace", fontSize: "12px", color: "#f39c12",
    }).setOrigin(0.5).setDepth(101);

    this.makeButton(width / 2, height / 2, "📺 WATCH AD (+5%)", 0x2d5a27, () => this.refill("ad"));
    this.makeButton(width / 2, height / 2 + 55, "💎 40 — REFILL 100%", 0x8a6a1a, () => this.refill("diamond"));
    this.makeButton(width / 2, height / 2 + 110, "CLOSE", 0x4a4e69, () => this.close());
  }

  private makeButton(x: number, y: number, label: string, color: number, onClick: () => void) {
    const btnWidth = 240;
    const btnHeight = 40;
    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, color, 1).setDepth(101).setStrokeStyle(2, 0xc5a97d);
    bg.setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: "Orbitron, monospace", fontSize: "13px", color: "#ffffff",
    }).setOrigin(0.5).setDepth(102);

    bg.on("pointerdown", () => { sfx.play("ui_click"); onClick(); });
    bg.on("pointerover", () => bg.setFillStyle(color, 0.8));
    bg.on("pointerout", () => bg.setFillStyle(color, 1));
    return { bg, text };
  }

  private async refill(method: "ad" | "diamond") {
    if (this.busy) return;
    this.busy = true;
    this.statusText.setText(method === "ad" ? "Loading ad..." : "Processing...");

    try {
      if (method === "ad") {
        const adResult = await showRewardedAd();
        if (!adResult.success) {
          this.statusText.setText(adResult.error ?? "Ad failed to load");
          this.busy = false;
          return;
        }
      }

      const res = await fetch("/api/weapon/ammo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weaponId: this.weaponId, method }),
      });
      const data = await res.json();

      if (data.success) {
        const gameScene = this.scene.get("GameScene") as Phaser.Scene & { setAmmo: (n: number) => void };
        gameScene.setAmmo(data.remaining);
        this.statusText.setText(`Refilled! ${data.remaining} ammo remaining today.`);
        sfx.play("pickup_item");
        this.time.delayedCall(900, () => this.close());
      } else {
        this.statusText.setText(data.error ?? "Refill failed");
      }
    } finally {
      this.busy = false;
    }
  }

  private close() {
    this.scene.resume("GameScene");
    this.scene.resume("HUDScene");
    this.scene.stop();
  }
}
