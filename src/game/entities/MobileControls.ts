import Phaser from "phaser";
import type { ControlScheme } from "@/lib/controlScheme";

/** v9 #6 / v14 rework / v20 rework / v22-v24 scheme choice: touch-only
 *  virtual controls — created by GameScene ONLY when the registry's
 *  "isMobile" flag is true, so none of this ever renders or attaches input
 *  listeners on desktop.
 *
 * Two schemes, chosen on the Settings page (see src/lib/controlScheme.ts)
 * and read once at construction:
 *
 *  - "joystick": a second fixed stick, bottom-right, mirrors the move stick —
 *    drag it in a direction to aim AND fire that way at the same time.
 *    Consumed via getFireVector() (a direction relative to the player).
 *
 *  - "split" (v24: back to the original v14 tap-to-aim-and-fire, after a
 *    detour through an aim-stick+FIRE-button split in v22/v23 that the user
 *    asked to undo): no stick, no separate fire button. Touching/holding
 *    anywhere on the right half of the screen aims AND fires at that exact
 *    point — release to stop. Consumed via getAimScreenPoint() (an absolute
 *    screen point, converted to a world point via the camera by the caller),
 *    null while nothing is held there. */
export class MobileControls {
  private scene: Phaser.Scene;
  private scheme: ControlScheme;

  private readonly baseRadius = 80;
  private readonly knobRadius = 38;
  private readonly maxTravel = 60;
  /** How far from a stick's center a touch-down still grabs it — bigger than
   *  the visible base so thumbs don't need pixel-perfect placement. */
  private readonly grabRadius = 110;

  private moveCenter: { x: number; y: number };
  private moveBase: Phaser.GameObjects.Arc;
  private moveKnob: Phaser.GameObjects.Arc;

  /** scheme "joystick" only — bottom-right stick that both aims and fires. */
  private aimCenter: { x: number; y: number };
  private aimBase?: Phaser.GameObjects.Arc;
  private aimKnob?: Phaser.GameObjects.Arc;

  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  /** scheme "joystick" only — raw drag vector of the bottom-right stick. */
  private aimVector = { x: 0, y: 0 };
  /** scheme "split" only — raw screen coords of the held right-half touch, or
   *  null when nothing is held (i.e. not aiming/firing right now). */
  private aimScreenPoint: { x: number; y: number } | null = null;

  private onDown: (p: Phaser.Input.Pointer) => void;
  private onMove: (p: Phaser.Input.Pointer) => void;
  private onUp: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, scheme: ControlScheme = "joystick") {
    this.scene = scene;
    this.scheme = scheme;
    const { width, height } = scene.scale;

    this.moveCenter = { x: 130, y: height - 130 };
    this.aimCenter = { x: width - 130, y: height - 130 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.moveKnob = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.knobRadius, 0xc5a97d, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    if (scheme === "joystick") {
      this.aimBase = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.baseRadius, 0xffffff, 0.12)
        .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff4444, 0.35);
      this.aimKnob = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.knobRadius, 0xc0392b, 0.5)
        .setScrollFactor(0).setDepth(DEPTH + 1);
    }
    // scheme "split" has no visible widget on the right side at all — the
    // whole right half of the screen is itself the aim/fire surface.

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

    if (this.scheme === "split") {
      if (this.aimPointerId === null && pointer.x >= this.scene.scale.width / 2) {
        this.aimPointerId = pointer.id;
        this.aimScreenPoint = { x: pointer.x, y: pointer.y };
      }
      return;
    }

    if (this.aimPointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.aimCenter.x, this.aimCenter.y) <= this.grabRadius) {
      this.aimPointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, (v) => (this.aimVector = v));
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, (v) => (this.moveVector = v));
    if (pointer.id !== this.aimPointerId) return;

    if (this.scheme === "split") this.aimScreenPoint = { x: pointer.x, y: pointer.y };
    else this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, (v) => (this.aimVector = v));
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
    }
    if (pointer.id === this.aimPointerId) {
      this.aimPointerId = null;
      if (this.scheme === "joystick") {
        this.aimVector = { x: 0, y: 0 };
        this.aimKnob?.setPosition(this.aimCenter.x, this.aimCenter.y);
      } else {
        this.aimScreenPoint = null; // releasing stops both aiming and firing
      }
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

  /** scheme "joystick" only — direction vector (each axis roughly -1..1) to
   *  aim/fire toward, relative to the player. Magnitude near 0 means "not
   *  firing right now". */
  getFireVector(): { x: number; y: number } {
    return this.aimVector;
  }

  /** scheme "split" only — absolute screen point to aim/fire at (feed through
   *  camera.getWorldPoint(), same as the desktop mouse pointer), or null if
   *  nothing is currently held on the right half of the screen. */
  getAimScreenPoint(): { x: number; y: number } | null {
    return this.aimScreenPoint;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.onDown);
    this.scene.input.off("pointermove", this.onMove);
    this.scene.input.off("pointerup", this.onUp);
    this.scene.input.off("pointerupoutside", this.onUp);
    this.moveBase.destroy();
    this.moveKnob.destroy();
    this.aimBase?.destroy();
    this.aimKnob?.destroy();
  }
}
