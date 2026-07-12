import Phaser from "phaser";
import type { ControlScheme } from "@/lib/controlScheme";

/** v9 #6 / v14 rework / v20 rework / v22 scheme choice: touch-only virtual
 *  controls — created by GameScene ONLY when the registry's "isMobile" flag
 *  is true, so none of this ever renders or attaches input listeners on desktop.
 *
 * v20: replaced tap-to-aim-and-fire-at-that-point with a second fixed
 * joystick, bottom-right, mirroring the move stick — drag it in a direction
 * to aim and fire that way (relative direction, not an absolute screen
 * point), same interaction model as the move stick instead of "tap anywhere
 * on the right half".
 *
 * v22: that bottom-right stick is now scheme 2 of 2, chosen on the Settings
 * page (see src/lib/controlScheme.ts) and read once at construction:
 *  - "joystick" (default, = the v20 behavior): the stick both aims AND fires.
 *  - "split": the stick ONLY turns the gun (never fires by itself); a
 *    separate FIRE button, top-left under the minimap, does the shooting —
 *    held down, it fires toward whatever direction the aim stick last pointed
 *    (retained even after the aim stick is released/re-centered, so a player
 *    can rest their thumb off the stick while still holding FIRE).
 *  Either way, callers keep using the SAME getFireVector() contract (a
 *  direction vector whose magnitude signals "should be firing right now") —
 *  GameScene/PvpScene don't need to know or care which scheme is active. */
export class MobileControls {
  private scene: Phaser.Scene;
  private scheme: ControlScheme;

  private readonly baseRadius = 80;
  private readonly knobRadius = 38;
  private readonly maxTravel = 60;
  /** How far from a stick's center a touch-down still grabs it — bigger than
   *  the visible base so thumbs don't need pixel-perfect placement. */
  private readonly grabRadius = 110;
  private readonly fireButtonRadius = 36;

  private moveCenter: { x: number; y: number };
  private moveBase: Phaser.GameObjects.Arc;
  private moveKnob: Phaser.GameObjects.Arc;

  /** Bottom-right stick — either the fire stick (scheme "joystick") or the
   *  aim-only stick (scheme "split"). Same visual object either way. */
  private aimCenter: { x: number; y: number };
  private aimBase: Phaser.GameObjects.Arc;
  private aimKnob: Phaser.GameObjects.Arc;

  /** scheme "split" only — separate FIRE button, top-left under the minimap. */
  private fireButtonCenter = { x: 55, y: 211 };
  private fireButton?: Phaser.GameObjects.Arc;
  private fireButtonText?: Phaser.GameObjects.Text;

  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;
  private fireButtonPointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  /** Raw drag vector of the bottom-right stick — in "joystick" scheme this
   *  IS the fire vector; in "split" scheme it only feeds lastAimDirection. */
  private aimVector = { x: 0, y: 0 };
  /** Last non-zero direction the aim stick was dragged toward — persists
   *  after the stick recenters, so releasing it mid-fight doesn't stop the
   *  FIRE button from shooting toward the last-aimed direction. Defaults to
   *  "up" so tapping FIRE before ever touching the aim stick still does
   *  something sane instead of firing nowhere. */
  private lastAimDirection = { x: 0, y: -1 };
  private fireButtonHeld = false;

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

    const aimStrokeColor = scheme === "split" ? 0xffffff : 0xff4444;
    const aimKnobColor = scheme === "split" ? 0xc5a97d : 0xc0392b;
    this.aimBase = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.baseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, aimStrokeColor, 0.35);
    this.aimKnob = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.knobRadius, aimKnobColor, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1);

    if (scheme === "split") {
      this.fireButton = scene.add.circle(this.fireButtonCenter.x, this.fireButtonCenter.y, this.fireButtonRadius, 0xc0392b, 0.55)
        .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff8080, 0.8);
      this.fireButtonText = scene.add.text(this.fireButtonCenter.x, this.fireButtonCenter.y, "FIRE", {
        fontFamily: "Orbitron, monospace", fontSize: "11px", color: "#ffffff", fontStyle: "bold",
      }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    }

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

    if (
      this.scheme === "split" &&
      this.fireButtonPointerId === null &&
      Phaser.Math.Distance.Between(pointer.x, pointer.y, this.fireButtonCenter.x, this.fireButtonCenter.y) <= this.fireButtonRadius + 20
    ) {
      this.fireButtonPointerId = pointer.id;
      this.fireButtonHeld = true;
      this.fireButton?.setFillStyle(0xff4444, 0.8);
      return;
    }

    if (this.aimPointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.aimCenter.x, this.aimCenter.y) <= this.grabRadius) {
      this.aimPointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob, (v) => this.setAimVector(v));
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, (v) => (this.moveVector = v));
    if (pointer.id === this.aimPointerId) this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob, (v) => this.setAimVector(v));
  }

  private handleUp(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) {
      this.movePointerId = null;
      this.moveVector = { x: 0, y: 0 };
      this.moveKnob.setPosition(this.moveCenter.x, this.moveCenter.y);
    }
    if (pointer.id === this.aimPointerId) {
      this.aimPointerId = null;
      this.aimVector = { x: 0, y: 0 }; // in "joystick" scheme this also stops firing; "split" keeps lastAimDirection
      this.aimKnob.setPosition(this.aimCenter.x, this.aimCenter.y);
    }
    if (pointer.id === this.fireButtonPointerId) {
      this.fireButtonPointerId = null;
      this.fireButtonHeld = false;
      this.fireButton?.setFillStyle(0xc0392b, 0.55);
    }
  }

  private setAimVector(v: { x: number; y: number }) {
    this.aimVector = v;
    const magnitude = Math.hypot(v.x, v.y);
    if (magnitude > 0.05) this.lastAimDirection = { x: v.x / magnitude, y: v.y / magnitude };
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
   *  to the player — not an absolute screen point. Magnitude near 0 means
   *  "not firing right now", regardless of which control scheme is active. */
  getFireVector(): { x: number; y: number } {
    if (this.scheme === "joystick") return this.aimVector;
    return this.fireButtonHeld ? this.lastAimDirection : { x: 0, y: 0 };
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
    this.fireButton?.destroy();
    this.fireButtonText?.destroy();
  }
}
