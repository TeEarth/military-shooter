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
