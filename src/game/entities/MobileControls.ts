import Phaser from "phaser";
import { getFireScale, getMoveScale, type ControlScheme } from "@/lib/controlScheme";

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

  // v33: each stick's size is independently adjustable on the Settings page
  // (see controlScheme.ts's getMoveScale/getFireScale) — read once here and
  // applied as a multiplier over these base numbers, per stick.
  private readonly moveBaseRadius: number;
  private readonly moveKnobRadius: number;
  private readonly moveMaxTravel: number;
  private readonly moveGrabRadius: number;
  private readonly aimBaseRadius: number;
  private readonly aimKnobRadius: number;
  private readonly aimMaxTravel: number;

  /** scheme "split" only — the move stick floats to wherever the left-half
   *  touch actually landed (see handleDown) instead of a small fixed circle,
   *  so the whole left half of the screen is walkable, not just one exact
   *  spot. "joystick" scheme keeps the original fixed corner. */
  private readonly isFloatingMove: boolean;
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
    this.isFloatingMove = scheme === "split";
    const { width, height } = scene.scale;

    const moveScale = getMoveScale();
    const fireScale = getFireScale();
    this.moveBaseRadius = 80 * moveScale;
    this.moveKnobRadius = 38 * moveScale;
    this.moveMaxTravel = 60 * moveScale;
    this.moveGrabRadius = 110 * moveScale;
    this.aimBaseRadius = 80 * fireScale;
    this.aimKnobRadius = 38 * fireScale;
    this.aimMaxTravel = 60 * fireScale;

    this.moveCenter = { x: 130, y: height - 130 };
    this.aimCenter = { x: width - 130, y: height - 130 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.moveBaseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3);
    this.moveKnob = scene.add.circle(this.moveCenter.x, this.moveCenter.y, this.moveKnobRadius, 0xc5a97d, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    if (scheme === "joystick") {
      this.aimBase = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.aimBaseRadius, 0xffffff, 0.12)
        .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff4444, 0.35);
      this.aimKnob = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.aimKnobRadius, 0xc0392b, 0.5)
        .setScrollFactor(0).setDepth(DEPTH + 1);
    } else {
      // v29 fix: scheme "split" now has a FLOATING move stick — hidden until
      // a left-half touch actually lands (see handleDown), instead of a
      // persistent stick glued to one small fixed corner that a thumb had to
      // land on pixel-perfectly.
      this.moveBase.setVisible(false);
      this.moveKnob.setVisible(false);
    }
    // scheme "split" has no visible widget on the right side at all — the
    // whole screen (outside HUD buttons and the active move touch) is itself
    // the aim/fire surface.

    this.onDown = (p) => this.handleDown(p);
    this.onMove = (p) => this.handleMove(p);
    this.onUp = (p) => this.handleUp(p);

    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointerupoutside", this.onUp);
  }

  /** v29: fixed screen-space zones the HUD's own buttons occupy (Pause/Exit,
   *  Refill top-right; Reload bottom-right) — kept in sync by hand with
   *  HUDScene's button positions since they live on a separate scene with no
   *  shared hit-test. A tap landing in one of these must never also register
   *  as a move/fire touch underneath the button. */
  private isInHudButtonZone(x: number, y: number): boolean {
    const { width, height } = this.scene.scale;
    // Pause/Exit + Refill cluster, top-right.
    if (x >= width - 100 && y <= 118) return true;
    // Reload button — bottom-right plain corner for "split" scheme (the
    // "joystick" scheme's raised reload sits just above its own fire stick,
    // which handleDown already reserves via the aimCenter grab check).
    if (!this.isFloatingMove) return false;
    return Phaser.Math.Distance.Between(x, y, width - 56, height - 56) <= 44;
  }

  private handleDown(pointer: Phaser.Input.Pointer) {
    if (this.isInHudButtonZone(pointer.x, pointer.y)) return;

    if (this.isFloatingMove) {
      // Left half, nothing else already claimed as the move touch — anchor a
      // fresh floating joystick right where the thumb landed, anywhere in
      // that half (not just one exact fixed spot).
      if (this.movePointerId === null && pointer.x < this.scene.scale.width / 2) {
        this.movePointerId = pointer.id;
        this.moveCenter = { x: pointer.x, y: pointer.y };
        this.moveBase.setPosition(pointer.x, pointer.y).setVisible(true);
        this.moveKnob.setPosition(pointer.x, pointer.y).setVisible(true);
        this.moveVector = { x: 0, y: 0 };
        return;
      }

      // Everything else not already the move touch or a HUD button — aim
      // and fire toward wherever this touch landed.
      if (this.aimPointerId === null) {
        this.aimPointerId = pointer.id;
        this.aimScreenPoint = { x: pointer.x, y: pointer.y };
      }
      return;
    }

    if (this.movePointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.moveCenter.x, this.moveCenter.y) <= this.moveGrabRadius) {
      this.movePointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, this.moveMaxTravel, (v) => (this.moveVector = v));
      return;
    }

    // v33 fix: firing used to require grabbing the fire stick's small circle
    // pixel-perfectly — any other touch on the right half did nothing. The
    // stick's base now stays fully fixed in place (never relocates, unlike
    // "split"'s floating move stick) but ANY touch anywhere on the right half
    // (outside the move stick's own zone and the HUD buttons, already
    // excluded above) now claims the fire pointer, so a thumb can fire from
    // wherever it lands. updateStick() below still clamps the knob's visual
    // travel to maxTravel regardless of how far the touch is from aimCenter,
    // so the direction reads correctly even from a touch far from the stick.
    if (this.aimPointerId === null && pointer.x >= this.scene.scale.width / 2) {
      this.aimPointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, this.aimMaxTravel, (v) => (this.aimVector = v));
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, this.moveMaxTravel, (v) => (this.moveVector = v));
    if (pointer.id !== this.aimPointerId) return;

    if (this.scheme === "split") this.aimScreenPoint = { x: pointer.x, y: pointer.y };
    else this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, this.aimMaxTravel, (v) => (this.aimVector = v));
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      if (this.isFloatingMove) {
        this.moveBase.setVisible(false);
        this.moveKnob.setVisible(false);
      } else {
        this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
      }
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

  private updateStick(px: number, py: number, center: { x: number; y: number }, knob: Phaser.GameObjects.Arc, maxTravel: number, setVector: (v: { x: number; y: number }) => void) {
    const dx = px - center.x;
    const dy = py - center.y;
    const d = Math.min(maxTravel, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const kx = center.x + Math.cos(angle) * d;
    const ky = center.y + Math.sin(angle) * d;
    knob.setPosition(kx, ky);
    setVector({ x: (kx - center.x) / maxTravel, y: (ky - center.y) / maxTravel });
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
