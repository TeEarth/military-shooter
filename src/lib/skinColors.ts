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

/** v58: a flat single-color tint read as "just painted over" rather than an
 *  actual skin pattern. Phaser's Image.setTint accepts 4 independent corner
 *  colors (a built-in bilinear gradient across the sprite) — used here to
 *  fake a diagonal two-tone pattern (base color on one diagonal, a darker
 *  shade on the other) purely from the existing single hex value, no new
 *  texture assets needed. Applied identically in Player.ts and
 *  RemotePlayer.ts so local and PvP-opponent rendering always match. */
export function applySkinTint(sprite: { setTint: (a: number, b: number, c: number, d: number) => void }, hex: number) {
  const dark = darkenHex(hex, 0.55);
  sprite.setTint(hex, dark, dark, hex);
}

function darkenHex(hex: number, factor: number): number {
  const r = Math.round(((hex >> 16) & 0xff) * factor);
  const g = Math.round(((hex >> 8) & 0xff) * factor);
  const b = Math.round((hex & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

function toCssHex(hex: number): string {
  return `#${hex.toString(16).padStart(6, "0")}`;
}

/** v58: the DOM skin preview (Character page swatch, Home portrait) used a
 *  single flat backgroundColor clipped to the sprite's silhouette, which
 *  read as "paint poured over the character" rather than a skin pattern.
 *  This is the CSS counterpart to applySkinTint above — a repeating
 *  diagonal stripe of the base color and a darker shade, still clipped by
 *  the exact same mask, so it reads as a pattern running across the body
 *  instead of a flat tint, and stays visually consistent with the in-game
 *  4-corner diagonal tint. */
export function skinPatternBackgroundImage(hex: number): string {
  const dark = toCssHex(darkenHex(hex, 0.55));
  const base = toCssHex(hex);
  return `repeating-linear-gradient(45deg, ${base} 0px, ${base} 7px, ${dark} 7px, ${dark} 14px)`;
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
