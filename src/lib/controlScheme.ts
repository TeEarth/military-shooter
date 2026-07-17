export type ControlScheme = "split" | "joystick";

const KEY = "mobile_control_scheme";
const DEFAULT_SCHEME: ControlScheme = "joystick";

/** "joystick" = drag the bottom-right stick to aim AND fire in that direction
 *  (the existing v20 scheme). "split" = that stick only turns the gun; a
 *  separate FIRE button (top-left, under the minimap) does the shooting. */
export function getControlScheme(): ControlScheme {
  if (typeof window === "undefined") return DEFAULT_SCHEME;
  const saved = localStorage.getItem(KEY);
  return saved === "split" || saved === "joystick" ? saved : DEFAULT_SCHEME;
}

export function setControlScheme(scheme: ControlScheme): void {
  localStorage.setItem(KEY, scheme);
}

// v33: per-stick size scale, adjustable on the Settings page — separate knobs
// for move vs fire since a player may want a bigger thumb target for one but
// not the other. Applied as a multiplier over MobileControls' base radii.
const MOVE_SCALE_KEY = "mobile_move_scale";
const FIRE_SCALE_KEY = "mobile_fire_scale";
export const MIN_CONTROL_SCALE = 0.6;
export const MAX_CONTROL_SCALE = 1.6;
const DEFAULT_CONTROL_SCALE = 1;

function getScale(key: string): number {
  if (typeof window === "undefined") return DEFAULT_CONTROL_SCALE;
  const saved = Number(localStorage.getItem(key));
  if (!saved || Number.isNaN(saved)) return DEFAULT_CONTROL_SCALE;
  return Math.min(MAX_CONTROL_SCALE, Math.max(MIN_CONTROL_SCALE, saved));
}

export function getMoveScale(): number {
  return getScale(MOVE_SCALE_KEY);
}
export function setMoveScale(scale: number): void {
  localStorage.setItem(MOVE_SCALE_KEY, String(scale));
}
export function getFireScale(): number {
  return getScale(FIRE_SCALE_KEY);
}
export function setFireScale(scale: number): void {
  localStorage.setItem(FIRE_SCALE_KEY, String(scale));
}
