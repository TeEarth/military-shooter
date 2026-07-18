import Phaser from "phaser";

const DURATION_MS = 5000;
const BOB_AMPLITUDE_PX = 8;
const BOB_PERIOD_MS = 900;

/** A bouncing arrow above the player's spawn position, shown for 5s at the
 *  start of every stage (Story/Farm/Boss/PvP/Tutorial) so the player can find
 *  themselves immediately, especially on large/cluttered maps. Pure world-space
 *  GameObjects (a triangle following the target every frame), so it scales
 *  naturally with whatever camera zoom is active — no special handling needed
 *  for that. Auto-destroys itself after 5s; returns nothing since nobody needs
 *  to manage it further. */
export function showSpawnIndicator(scene: Phaser.Scene, target: Phaser.GameObjects.Image): void {
  const arrow = scene.add.triangle(target.x, target.y - 70, 0, 22, 22, 22, 11, 0, 0xf3c98a).setDepth(150).setStrokeStyle(2, 0x2d5a27);
  const startTime = scene.time.now;

  const onUpdate = () => {
    const elapsed = scene.time.now - startTime;
    const bob = Math.sin(elapsed / BOB_PERIOD_MS * Math.PI * 2) * BOB_AMPLITUDE_PX;
    arrow.setPosition(target.x, target.y - 70 + bob);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);

  scene.time.delayedCall(DURATION_MS, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    arrow.destroy();
  });
}
