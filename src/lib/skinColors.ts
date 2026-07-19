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

/** v59: "pattern" means the CHARACTER'S OWN COLORS stay untouched and only a
 *  colored marking runs across the body — the v58 two-tone diagonal still
 *  recolored 100% of the sprite (just with 2 shades of the chosen color
 *  instead of 1 flat one), which isn't what a pattern is. Phaser's
 *  Image.setTint only offers a 4-corner bilinear gradient multiply (no true
 *  masking without a custom shader), so the closest honest approximation is:
 *  multiplying by WHITE (0xffffff) leaves a pixel's original color exactly
 *  unchanged, while multiplying by the chosen hex recolors it. Putting white
 *  on one diagonal pair of corners and the chosen color on the other means
 *  one diagonal half of the sprite renders in its true original colors and
 *  the opposite diagonal band carries the colored pattern, fading between
 *  them — the character's own art stays visible instead of being replaced.
 *  Applied identically in Player.ts and RemotePlayer.ts so local and
 *  PvP-opponent rendering always match. */
export function applySkinTint(sprite: { setTint: (a: number, b: number, c: number, d: number) => void }, hex: number) {
  sprite.setTint(0xffffff, hex, hex, 0xffffff);
}

function toCssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** v59: this is the CSS counterpart to the corrected applySkinTint above —
 *  the original character art (rendered underneath, unchanged) must stay
 *  visible, with only a colored diagonal stripe pattern laid over it. Narrow
 *  colored bands with wide TRANSPARENT gaps (not a second shade) let most of
 *  the underlying sprite show through untouched; mixBlendMode: "multiply" on
 *  the element using this background (set at the call site, same as before)
 *  keeps the colored bands themselves from fully blotting out the art
 *  underneath them either. */
export function skinPatternBackgroundImage(hex: number): string {
  const base = toCssHex(hex);
  return `repeating-linear-gradient(45deg, ${base} 0px, ${base} 5px, transparent 5px, transparent 22px)`;
}

/** v42: skin ownership/equip state is scoped PER CHARACTER — sharing one
 *  global skinColor across every character was the actual bug report (buying
 *  a color for one character silently recolored every other one too). These
 *  two helpers are the single place that reads a per-character entry out of
 *  the player's {characterId: colorId} / {characterId: colorId[]} maps, with
 *  a safe "default" fallback for a character never touched yet. */
export function getEquippedSkinColor(skinColors: Record<string, string>, characterId: string): SkinColor {
  const value = skinColors[characterId];
  return value && isSkinColor(value) ? value : "default";
}

export function getOwnedSkinColors(ownedSkinsByCharacter: Record<string, string[]>, characterId: string): SkinColor[] {
  const owned = ownedSkinsByCharacter[characterId];
  const valid = Array.isArray(owned) ? owned.filter(isSkinColor) : [];
  return valid.includes("default") ? valid : ["default", ...valid];
}
