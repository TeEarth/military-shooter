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

  /** v64: the move stick is a fixed, always-visible circle in BOTH schemes —
   *  it used to float to wherever "split" scheme's left-half touch landed
   *  (v29), then was made always-visible-but-still-floating (v63); per
   *  request it no longer relocates at all, same fixed-anchor + grab-radius
   *  behavior as "joystick" scheme's stick always had. */
  private readonly moveCenter: { x: number; y: number };
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

    // v33: each stick's size is independently adjustable on the Settings
    // page (getMoveScale/getFireScale — a 0.6-1.6 slider). v64: the move
    // slider now applies in BOTH schemes (used to be joystick-scheme only),
    // and Layout 1 ("split")'s move stick keeps its own extra 30% boost on
    // top of that, since it was reported too small even before the slider
    // was exposed there.
    const moveScale = getMoveScale();
    const fireScale = getFireScale();
    const layout1SizeBoost = scheme === "split" ? 1.3 : 1;
    this.moveBaseRadius = 80 * moveScale * layout1SizeBoost;
    this.moveKnobRadius = 38 * moveScale * layout1SizeBoost;
    this.moveMaxTravel = 60 * moveScale * layout1SizeBoost;
    this.moveGrabRadius = 110 * moveScale * layout1SizeBoost;
    this.aimBaseRadius = 80 * fireScale;
    this.aimKnobRadius = 38 * fireScale;
    this.aimMaxTravel = 60 * fireScale;

    this.moveCenter = { x: 130, y: height - 130 };
    this.aimCenter = { x: width - 130, y: height - 130 };

    const DEPTH = 2000;
    this.moveBase = scene.add.circle(this.uiX(this.moveCenter.x), this.uiY(this.moveCenter.y), this.moveBaseRadius, 0xffffff, 0.12)
      .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xffffff, 0.3).setScale(this.uiScale);
    this.moveKnob = scene.add.circle(this.uiX(this.moveCenter.x), this.uiY(this.moveCenter.y), this.moveKnobRadius, 0xc5a97d, 0.5)
      .setScrollFactor(0).setDepth(DEPTH + 1).setScale(this.uiScale);

    if (scheme === "joystick") {
      this.aimBase = scene.add.circle(this.uiX(this.aimCenter.x), this.uiY(this.aimCenter.y), this.aimBaseRadius, 0xffffff, 0.12)
        .setScrollFactor(0).setDepth(DEPTH).setStrokeStyle(2, 0xff4444, 0.35).setScale(this.uiScale);
      this.aimKnob = scene.add.circle(this.uiX(this.aimCenter.x), this.uiY(this.aimCenter.y), this.aimKnobRadius, 0xc0392b, 0.5)
        .setScrollFactor(0).setDepth(DEPTH + 1).setScale(this.uiScale);
    }
    // scheme "split" has no visible widget on the right side at all — the
    // whole screen (outside HUD buttons and the active move touch) is itself
    // the aim/fire surface. v63: the move stick itself is now always visible
    // from the start in BOTH schemes — no more tap-to-reveal.

    this.onDown = (p) => this.handleDown(p);
    this.onMove = (p) => this.handleMove(p);
    this.onUp = (p) => this.handleUp(p);

    scene.input.on("pointerdown", this.onDown);
    scene.input.on("pointermove", this.onMove);
    scene.input.on("pointerup", this.onUp);
    scene.input.on("pointerupoutside", this.onUp);
  }

  /** v63 fix: this class lives inside GameScene/PvpScene, which apply the
   *  player's chosen camera zoom (100/120/140%, see controlScheme.ts) — a
   *  scrollFactor(0) object is STILL subject to that zoom (Phaser
   *  scales/repositions it around the camera's origin), so the joystick
   *  circles rendered shifted and oversized at anything other than 100%
   *  zoom, sometimes pushing them partly off-screen. Same root cause and
   *  same fix already applied to TutorialScene.ts's fixed UI — uiX/uiY
   *  convert an intended TRUE screen position to the position that renders
   *  at that true position once the camera's zoom transform is applied, and
   *  uiScale compensates the visual size. Hit-testing (moveCenter/aimCenter
   *  vs. pointer.x/y) is untouched — Phaser's pointer coordinates are
   *  already true screen pixels regardless of zoom, so only the RENDERED
   *  circle positions/sizes ever needed compensating. */
  private uiX(x: number): number {
    const cam = this.scene.cameras.main;
    const originX = cam.width * cam.originX;
    return originX + (x - originX) / cam.zoom;
  }

  private uiY(y: number): number {
    const cam = this.scene.cameras.main;
    const originY = cam.height * cam.originY;
    return originY + (y - originY) / cam.zoom;
  }

  private get uiScale(): number {
    return 1 / this.scene.cameras.main.zoom;
  }

  /** v29: fixed screen-space zones the HUD's own buttons occupy (Pause/Exit,
   *  Refill top-right; Reload/Swap/One-Shot stacked bottom-right) — kept in
   *  sync by hand with HUDScene's button positions since they live on a
   *  separate scene with no shared hit-test. A tap landing in one of these
   *  must never also register as a move/fire touch underneath the button.
   *  v37 fix: the "joystick" scheme used to skip this bottom-right check
   *  entirely, relying on fire only triggering inside the aim stick's own
   *  grabRadius to naturally miss the reload button above it — but v33
   *  changed that scheme to fire from anywhere on the right half, which
   *  meant pressing Reload/Swap/One-Shot also fired a shot underneath them.
   *  Both schemes now explicitly reserve every stacked button's circle. */
  private isInHudButtonZone(x: number, y: number): boolean {
    const { width, height } = this.scene.scale;
    // Pause/Exit + Refill cluster, top-right.
    if (x >= width - 100 && y <= 118) return true;

    // v48: Tutorial's guided-intro box (Next/Skip buttons + description),
    // bottom-center — reserved so tapping Next/Skip on mobile doesn't ALSO
    // register as a move/fire touch underneath. Only ever occupied outside
    // TutorialScene's intro, so this is a no-op zone in every other mode.
    if (this.scene.registry.get("tutorialIntroActive")) {
      const boxWidth = Math.min(520, width - 32);
      const centerX = width / 2;
      const centerY = height - 130;
      if (x >= centerX - boxWidth / 2 && x <= centerX + boxWidth / 2 && y >= centerY - 75 && y <= centerY + 75) return true;
    }

    const radius = 30;
    const raised = this.scheme === "joystick";
    const cx = raised ? width - 130 : width - 56;
    const reloadCy = raised ? height - 210 - radius - 14 : height - 56;
    // Reload is always reserved; Swap/One-Shot stack above it only when that
    // perk is actually owned (see registry's "perks", set by GameClient.tsx —
    // same source HUDScene reads to decide whether to create those buttons).
    const perks = this.scene.registry.get("perks") as { spareWeapon?: boolean; oneShot?: boolean } | undefined;
    let stackCount = 1;
    if (perks?.spareWeapon) stackCount++;
    if (perks?.oneShot) stackCount++;

    for (let i = 0; i < stackCount; i++) {
      const cy = reloadCy - i * (radius * 2 + 14);
      if (Phaser.Math.Distance.Between(x, y, cx, cy) <= radius + 14) return true;
    }
    return false;
  }

  private handleDown(pointer: Phaser.Input.Pointer) {
    if (this.isInHudButtonZone(pointer.x, pointer.y)) return;

    // v64: the move stick is fixed in place in BOTH schemes now — grabbing
    // it requires landing within moveGrabRadius of its fixed anchor (same
    // rule "joystick" scheme always used).
    if (this.movePointerId === null && Phaser.Math.Distance.Between(pointer.x, pointer.y, this.moveCenter.x, this.moveCenter.y) <= this.moveGrabRadius) {
      this.movePointerId = pointer.id;
      this.updateStick(pointer.x, pointer.y, this.moveCenter, this.moveKnob, this.moveMaxTravel, (v) => (this.moveVector = v));
      return;
    }

    // v33 fix: firing used to require grabbing the fire stick's small circle
    // pixel-perfectly — any other touch on the right half did nothing. The
    // stick's base stays fully fixed in place, but ANY touch anywhere on the
    // right half (outside the move stick's own zone and the HUD buttons,
    // already excluded above) now claims the fire pointer, so a thumb can
    // fire from wherever it lands. "split" scheme aims/fires at the exact
    // touch point instead of dragging a stick.
    if (this.aimPointerId === null && pointer.x >= this.scene.scale.width / 2) {
      this.aimPointerId = pointer.id;
      if (this.scheme === "split") this.aimScreenPoint = { x: pointer.x, y: pointer.y };
      else this.updateStick(pointer.x, pointer.y, this.aimCenter, this.aimKnob!, this.aimMaxTravel, (v) => (this.aimVector = v));
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
      this.moveKnob.setPosition(this.uiX(this.moveCenter.x), this.uiY(this.moveCenter.y));
    }
    if (pointer.id === this.aimPointerId) {
      this.aimPointerId = null;
      if (this.scheme === "joystick") {
        this.aimVector = { x: 0, y: 0 };
        this.aimKnob?.setPosition(this.uiX(this.aimCenter.x), this.uiY(this.aimCenter.y));
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
    knob.setPosition(this.uiX(kx), this.uiY(ky));
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
