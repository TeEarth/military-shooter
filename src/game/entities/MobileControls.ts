import Phaser from "phaser";

/** v9 #6: touch-only virtual controls — created by GameScene ONLY when the
 *  registry's "isMobile" flag is true (set in GameClient.tsx from a touch +
 *  narrow-viewport check), so none of this ever renders or attaches input
 *  listeners on desktop. Movement joystick bottom-left, aim joystick +
 *  fire button bottom-right, all screen-fixed (setScrollFactor(0)). */
export class MobileControls {
  private scene: Phaser.Scene;

  private readonly baseRadius = 55;
  private readonly knobRadius = 26;
  private readonly maxTravel = 45;
  private readonly fireRadius = 34;

  private moveCenter: { x: number; y: number };
  private aimCenter: { x: number; y: number };
  private fireCenter: { x: number; y: number };

  private moveBase: Phaser.GameObjects.Arc;
  private moveKnob: Phaser.GameObjects.Arc;
  private aimBase: Phaser.GameObjects.Arc;
  private aimKnob: Phaser.GameObjects.Arc;
  private fireButton: Phaser.GameObjects.Arc;

  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;
  private firePointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  private aimVector: { x: number; y: number } | null = null;
  private firing = false;

  private onDown: (p: Phaser.Input.Pointer) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;

    this.moveCenter = { x: 110, y: height - 110 };
    this.aimCenter = { x: width - 110, y: height - 110 };
    this.fireCenter = { x: width - 110, y: height - 200 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.moveKnob = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.knobRadius, 0xc5a97d, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    this.aimBase = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.aimKnob = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.knobRadius, 0xc0392b, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    this.fireButton = scene.add.circle(this.fireCenter.x, this.fireCenter.y, this.fireRadius, 0xf39c12, 0.45)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.4);
    scene.add.text(this.fireCenter.x, this.fireCenter.y, "FIRE", {
      fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);

    this.onDown = (p) => this.handleDown(p);
    this.onMove = (p) => this.handleMove(p);
    this.onUp = (p) => this.handleUp(p);

    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointerupoutside", this.onUp);
  }

  private dist(ax: number, ay: number, bx: number, by: number) {
    return Phaser.Math.Distance.Between(ax, ay, bx, by);
  }

  private handleDown(pointer: Phaser.Input.Pointer) {
    const { width } = this.scene.scale;

    if (pointer.x < width / 2) {
      if (this.movePointerId === null) {
        this.movePointerId = pointer.id;
        this.updateMoveKnob(pointer.x, pointer.y);
      }
      return;
    }

    if (this.firePointerId === null && this.dist(pointer.x, pointer.y, this.fireCenter.x, this.fireCenter.y) <= this.fireRadius + 12) {
      this.firePointerId = pointer.id;
      this.firing = true;
      this.fireButton.setFillStyle(0xf39c12, 0.8);
      return;
    }

    if (this.aimPointerId === null) {
      this.aimPointerId = pointer.id;
      this.updateAimKnob(pointer.x, pointer.y);
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateMoveKnob(pointer.x, pointer.y);
    if (pointer.id === this.aimPointerId) this.updateAimKnob(pointer.x, pointer.y);
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
    }
    if (pointer.id === this.aimPointerId) {
      this.aimPointerId = null;
      this.aimKnob.setPosition(this.aimCenter.x, this.aimCenter.y);
      // Deliberately leave this.aimVector at its last value (not reset to null)
      // so the character keeps facing/firing the last aimed direction after
      // the stick is released mid-fire, matching typical touch-shooter feel.
    }
    if (pointer.id === this.firePointerId) {
      this.firePointerId = null;
      this.firing = false;
      this.fireButton.setFillStyle(0xf39c12, 0.45);
    }
  }

  private updateMoveKnob(px: number, py: number) {
    const dx = px - this.moveCenter.x;
    const dy = py - this.moveCenter.y;
    const d = Math.min(this.maxTravel, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = this.moveCenter.x + Math.cos(angle) * d;
    const ky = this.moveCenter.y + Math.sin(angle) * d;
    this.moveKnob.setPosition(kx, ky);
    this.moveVector = { x: (kx - this.moveCenter.x) / this.maxTravel, y: (ky - this.moveCenter.y) / this.maxTravel };
  }

  private updateAimKnob(px: number, py: number) {
    const dx = px - this.aimCenter.x;
    const dy = py - this.aimCenter.y;
    const d = Math.min(this.maxTravel, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = this.aimCenter.x + Math.cos(angle) * d;
    const ky = this.aimCenter.y + Math.sin(angle) * d;
    this.aimKnob.setPosition(kx, ky);
    // Normalized direction only (magnitude irrelevant for aim — it's a direction, not a throttle).
    const len = Math.hypot(dx, dy) || 1;
    this.aimVector = { x: dx / len, y: dy / len };
  }

  getMoveVector() {
    return this.moveVector;
  }

  /** Null only before the aim stick has ever been touched — otherwise holds the
   *  last aimed direction even after release (see handleUp's comment). */
  getAimVector() {
    return this.aimVector;
  }

  isFiring() {
    return this.firing;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointerupoutside", this.onUp);
    this.moveBase.destroy();
    this.moveKnob.destroy();
    this.aimBase.destroy();
    this.aimKnob.destroy();
    this.fireButton.destroy();
  }
}
