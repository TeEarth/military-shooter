import Phaser from "phaser";

/** v9 #6 / v14 rework: touch-only virtual controls — created by GameScene
 *  ONLY when the registry's "isMobile" flag is true, so none of this ever
 *  renders or attaches input listeners on desktop.
 *
 * v14: replaced the separate aim-joystick + fire-button pair with direct
 * tap-to-aim-and-fire on the right half of the screen — holding a finger
 * anywhere there aims the gun at that exact screen point and fires
 * continuously at it (same targeting model desktop's mouse already uses),
 * which is what makes the Grenade Launcher's lobbed shot land exactly where
 * you tapped instead of just "in that general direction". The move joystick
 * (left half) is also enlarged per feedback that the old one was too small
 * to comfortably control with a thumb. */
export class MobileControls {
  private scene: Phaser.Scene;

  private readonly baseRadius = 80;
  private readonly knobRadius = 38;
  private readonly maxTravel = 60;

  private moveCenter: { x: number; y: number };
  private moveBase: Phaser.GameObjects.Arc;
  private moveKnob: Phaser.GameObjects.Arc;

  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  /** Raw screen coordinates of the right-half touch, or null if nothing is
   *  currently held there — null means "not aiming, not firing". */
  private aimScreenPoint: { x: number; y: number } | null = null;

  private onDown: (p: Phaser.Input.Pointer) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const { height } = scene.scale;

    this.moveCenter = { x: 130, y: height - 130 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.moveKnob = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.knobRadius, 0xc5a97d, 0.5)
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
    const { width } = this.scene.scale;

    if (pointer.x < width / 2) {
      if (this.movePointerId === null) {
        this.movePointerId = pointer.id;
        this.updateMoveKnob(pointer.x, pointer.y);
      }
      return;
    }

    if (this.aimPointerId === null) {
      this.aimPointerId = pointer.id;
      this.aimScreenPoint = { x: pointer.x, y: pointer.y };
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateMoveKnob(pointer.x, pointer.y);
    if (pointer.id === this.aimPointerId) this.aimScreenPoint = { x: pointer.x, y: pointer.y };
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
    }
    if (pointer.id === this.aimPointerId) {
      this.aimPointerId = null;
      this.aimScreenPoint = null; // releasing stops both aiming and firing
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

  getMoveVector() {
    return this.moveVector;
  }

  /** Screen-space point to aim/fire at (feed through camera.getWorldPoint(),
   *  same as the desktop mouse pointer) — null means not currently holding a
   *  touch on the right half, i.e. not firing. */
  getAimScreenPoint() {
    return this.aimScreenPoint;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointerupoutside", this.onUp);
    this.moveBase.destroy();
    this.moveKnob.destroy();
  }
}
