import Phaser from "phaser";

/** v9 #6 / v14 rework / v20 rework: touch-only virtual controls — created by
 *  GameScene ONLY when the registry's "isMobile" flag is true, so none of
 *  this ever renders or attaches input listeners on desktop.
 *
 * v20: replaced tap-to-aim-and-fire-at-that-point with a second fixed
 * joystick, bottom-right, mirroring the move stick — drag it in a direction
 * to aim and fire that way (relative direction, not an absolute screen
 * point), same interaction model as the move stick instead of "tap anywhere
 * on the right half". Both sticks are now grabbed by touching near their
 * base (a generous radius around each), not by which half of the screen
 * you touched. */
export class MobileControls {
  private scene: Phaser.Scene;

  private readonly baseRadius = 80;
  private readonly knobRadius = 38;
  private readonly maxTravel = 60;
  /** How far from a stick's center a touch-down still grabs it — bigger than
   *  the visible base so thumbs don't need pixel-perfect placement. */
  private readonly grabRadius = 110;

  private moveCenter: { x: number; y: number };
  private moveBase: Phaser.GameObjects.Arc;
  private moveKnob: Phaser.GameObjects.Arc;

  private fireCenter: { x: number; y: number };
  private fireBase: Phaser.GameObjects.Arc;
  private fireKnob: Phaser.GameObjects.Arc;

  private movePointerId: number | null = null;
  private firePointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  private fireVector = { x: 0, y: 0 };

  private onDown: (p: Phaser.Input.Pointer) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { width, height } = scene.scale;

    this.moveCenter = { x: 130, y: height - 130 };
    this.fireCenter = { x: width - 130, y: height - 130 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.moveKnob = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.knobRadius, 0xc5a97d, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    this.fireBase = scene.add.circle(this.fireCenter.x, this.fireCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff4444, 0.35);
    this.fireKnob = scene.add.circle(this.fireCenter.x, this.fireCenter.y, this.knobRadius, 0xc0392b, 0.55)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    this.onDown = (p) => this.handleDown(p);
    this.onMove = (p) => this.handleMove(p);
    this.onUp = (p) => this.handleUp(p);

    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointerupoutside", this.onUp);
  }

  private handleDown(pointer: Phaser.Input.Pointer) {
    if (this.movePointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.moveCenter.x, this.moveCenter.y) <= this.grabRadius) {
      this.movePointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, (v) => (this.moveVector = v));
      return;
    }

    if (this.firePointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.fireCenter.x, this.fireCenter.y) <= this.grabRadius) {
      this.firePointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.fireCenter, this.fireKnob, (v) => (this.fireVector = v));
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, (v) => (this.moveVector = v));
    if (pointer.id === this.firePointerId) this.updateStick(pointer.x, pointer.y, this.fireCenter, this.fireKnob, (v) => (this.fireVector = v));
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
    }
    if (pointer.id === this.firePointerId) {
      this.firePointerId = null;
      this.fireVector = { x: 0, y: 0 }; // releasing the stick stops firing
      this.fireKnob.setPosition(this.fireCenter.x, this.fireCenter.y);
    }
  }

  private updateStick(px: number, py: number, center: { x: number; y: number }, knob: Phaser.GameObjects.Arc, setVector: (v: { x: number; y: number }) => void) {
    const dx = px - center.x;
    const dy = py - center.y;
    const d = Math.min(this.maxTravel, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = center.x + Math.cos(angle) * d;
    const ky = center.y + Math.sin(angle) * d;
    knob.setPosition(kx, ky);
    setVector({ x: (kx - center.x) / this.maxTravel, y: (ky - center.y) / this.maxTravel });
  }

  getMoveVector() {
    return this.moveVector;
  }

  /** Direction vector (each axis roughly -1..1) to aim/fire toward, relative
   *  to the player — not an absolute screen point. Magnitude near 0 means the
   *  stick is centered/released, i.e. not firing. */
  getFireVector() {
    return this.fireVector;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointerupoutside", this.onUp);
    this.moveBase.destroy();
    this.moveKnob.destroy();
    this.fireBase.destroy();
    this.fireKnob.destroy();
  }
}
