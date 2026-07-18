/** Cosmetic color-tint skins for the player character — a Phaser tint applied
 *  over the existing sprite, not a separate costume/sprite swap. "default" is
 *  free and owned by everyone; the other 4 cost SKIN_COLOR_PRICE coins each. */
export const SKIN_COLORS = ["default", "red", "blue", "green", "purple", "gold"] as const;
export type SkinColor = (typeof SKIN_COLORS)[number];

export const SKIN_COLOR_PRICE = 200;

/** null = no tint (renders the sprite's own original colors). */
export const SKIN_COLOR_HEX: Record<SkinColor, number | null> = {
  default: null,
  red: 0xe74c3c,
  blue: 0x3498db,
  green: 0x2ecc71,
  purple: 0x9b59b6,
  gold: 0xf1c40f,
};

export function isSkinColor(value: string): value is SkinColor {
  return (SKIN_COLORS as readonly string[]).includes(value);
}
