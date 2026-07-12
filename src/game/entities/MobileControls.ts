import Phaser from "phaser";
import type { ControlScheme } from "@/lib/controlScheme";

/** v9 #6 / v14 rework / v20 rework / v22-v23 scheme choice: touch-only
 *  virtual controls — created by GameScene ONLY when the registry's
 *  "isMobile" flag is true, so none of this ever renders or attaches input
 *  listeners on desktop.
 *
 * Two schemes, chosen on the Settings page (see src/lib/controlScheme.ts)
 * and read once at construction — either way, callers keep using the SAME
 * getFireVector() contract (a direction vector whose magnitude signals
 * "should be firing right now"), so GameScene/PvpScene don't need to know or
 * care which scheme is active:
 *
 *  - "joystick": a second fixed stick, bottom-right, mirrors the move stick —
 *    drag it in a direction to aim AND fire that way at the same time.
 *
 *  - "split" (v23 rework): no bottom-right stick at all. Touching/holding
 *    anywhere on the right half of the screen turns the gun toward that
 *    point (tap-to-aim, like the original v14 scheme) but does NOT fire by
 *    itself; a separate FIRE button, top-left under the minimap, does the
 *    shooting — held down, it fires toward wherever the player last aimed,
 *    even after lifting the aiming finger, so resting off-screen mid-fight
 *    doesn't stop the FIRE button from working. The aim direction is
 *    computed relative to SCREEN CENTER rather than the player's exact
 *    world position — since the camera follows the player, screen-center
 *    is always a close approximation of "where the player currently is",
 *    without this class needing to know the player's position at all. */
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

  /** scheme "joystick" only — bottom-right stick that both aims and fires. */
  private aimCenter: { x: number; y: number };
  private aimBase?: Phaser.GameObjects.Arc;
  private aimKnob?: Phaser.GameObjects.Arc;

  /** scheme "split" only — separate FIRE button, top-left under the minimap. */
  private fireButtonCenter = { x: 55, y: 211 };
  private fireButton?: Phaser.GameObjects.Arc;
  private fireButtonText?: Phaser.GameObjects.Text;

  private movePointerId: number | null = null;
  private aimPointerId: number | null = null;
  private fireButtonPointerId: number | null = null;

  private moveVector = { x: 0, y: 0 };
  /** scheme "joystick": raw drag vector of the bottom-right stick — this IS
   *  the fire vector directly. Unused in scheme "split". */
  private aimVector = { x: 0, y: 0 };
  /** Last non-zero direction the player aimed toward — persists after the
   *  stick recenters/finger lifts, so the FIRE button (scheme "split") or a
   *  released stick (scheme "joystick", between touches) keeps a sane
   *  direction. Defaults to "up" so firing before ever aiming still does
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

    if (scheme === "joystick") {
      this.aimBase = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.baseRadius, 0xffffff, 0.12)
        .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff4444, 0.35);
      this.aimKnob = scene.add.circle(this.aimCenter.x, this.aimCenter.y, this.knobRadius, 0xc0392b, 0.5)
        .setScrollFactor(0).setDepth(DEPTH + 1);
    } else {
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

    if (this.scheme === "split") {
      if (
        this.fireButtonPointerId === null &&
        Phaser.Math.Distance.Between(pointer.x, pointer.y, this.fireButtonCenter.x, this.fireButtonCenter.y) <= this.fireButtonRadius + 20
      ) {
        this.fireButtonPointerId = pointer.id;
        this.fireButtonHeld = true;
        this.fireButton?.setFillStyle(0xff4444, 0.8);
        return;
      }

      // Tap-to-aim: anywhere on the right half of the screen turns the gun
      // (doesn't fire — see class doc).
      if (this.aimPointerId === null && pointer.x >= this.scene.scale.width / 2) {
        this.aimPointerId = pointer.id;
        this.updateAimFromScreenPoint(pointer.x, pointer.y);
      }
      return;
    }

    if (this.aimPointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.aimCenter.x, this.aimCenter.y) <= this.grabRadius) {
      this.aimPointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, (v) => this.setAimVector(v));
    }
  }

  private handleMove(pointer: Phaser.Input.Pointer) {
    if (pointer.id === this.movePointerId) this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, (v) => (this.moveVector = v));
    if (pointer.id !== this.aimPointerId) return;

    if (this.scheme === "split") this.updateAimFromScreenPoint(pointer.x, pointer.y);
    else this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, (v) => this.setAimVector(v));
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
        this.aimVector = { x: 0, y: 0 }; // releasing the stick also stops firing in this scheme
        this.aimKnob?.setPosition(this.aimCenter.x, this.aimCenter.y);
      }
      // scheme "split": lifting the aiming finger keeps lastAimDirection as-is
      // — FIRE (a separate touch) keeps shooting that way.
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

  /** scheme "split" only — direction relative to screen CENTER (not the
   *  player's exact world position, which this class doesn't track) — since
   *  the camera follows the player, screen-center closely approximates
   *  "where the player currently is" without needing that coupling. */
  private updateAimFromScreenPoint(px: number, py: number) {
    const { width, height } = this.scene.scale;
    const dx = px - width / 2;
    const dy = py - height / 2;
    const magnitude = Math.hypot(dx, dy);
    if (magnitude < 5) return; // ignore near-dead-center taps rather than risk a zero-length direction
    this.lastAimDirection = { x: dx / magnitude, y: dy / magnitude };
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
    this.aimBase?.destroy();
    this.aimKnob?.destroy();
    this.fireButton?.destroy();
    this.fireButtonText?.destroy();
  }
}
