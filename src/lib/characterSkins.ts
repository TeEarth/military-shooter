/** v60: replaces the old color-tint system (formerly src/lib/skinColors.ts)
 *  entirely. Skins are now real sprite assets, not a Phaser tint/CSS overlay
 *  over the base art — equipping a skin swaps which SVG file is loaded, so
 *  every mode (Story, Training, Boss, PvP, Tutorial, Home, Character page)
 *  renders the exact same asset because they all resolve the sprite URL
 *  through characterSkinSpritePath() from a single source: the player's
 *  server-side skinColors map (DB column reused as-is; see below). */
export const SKIN_IDS = ["default", "desert", "urban", "jungle", "arctic", "elite"] as const;
export type SkinId = (typeof SKIN_IDS)[number];

export function isSkinId(value: string): value is SkinId {
  return (SKIN_IDS as readonly string[]).includes(value);
}

/** default is free/owned by everyone; the rest are purchasable with coin,
 *  except "elite" which is a premium diamond skin. */
export const SKIN_PRICE: Record<SkinId, { currency: "coin" | "diamond"; amount: number } | null> = {
  default: null,
  desert: { currency: "coin", amount: 250 },
  urban: { currency: "coin", amount: 250 },
  jungle: { currency: "coin", amount: 250 },
  arctic: { currency: "coin", amount: 300 },
  elite: { currency: "diamond", amount: 150 },
};

export const SKIN_LABEL: Record<SkinId, string> = {
  default: "Default",
  desert: "Desert",
  urban: "Urban",
  jungle: "Jungle",
  arctic: "Arctic",
  elite: "Elite",
};

/** The single place a (base sprite URL, skin id) pair becomes an actual
 *  asset URL. Every character's default sprite lives at
 *  `.../${characterId}_${rank}.svg`; each non-default skin is a sibling file
 *  named `..._${skinId}.svg` (see public/assets/sprites/characters/) — no
 *  per-character lookup table needed, so adding a new character's skins
 *  later is just dropping files with this same naming convention, no code
 *  change required. */
export function characterSkinSpritePath(baseSprite: string, skinId: string | undefined): string {
  if (!baseSprite || !skinId || skinId === "default" || !isSkinId(skinId)) return baseSprite;
  return baseSprite.replace(/\.svg$/, `_${skinId}.svg`);
}

/** v42: ownership/equip state is scoped PER CHARACTER — these two helpers
 *  are the single place that reads a per-character entry out of the
 *  player's {characterId: skinId} / {characterId: skinId[]} maps, with a
 *  safe "default" fallback for a character never touched yet. Reuses the
 *  exact same DB columns/JSON shape the old color system used (skin_colors,
 *  owned_skins_by_character) — only the values stored inside now mean "skin
 *  id" instead of "color id", so no DB migration is needed; any stale old
 *  color ids (red/blue/...) simply fail isSkinId and fall back to default. */
export function getEquippedSkin(skinColors: Record<string, string>, characterId: string): SkinId {
  const value = skinColors[characterId];
  return value && isSkinId(value) ? value : "default";
}

export function getOwnedSkins(ownedSkinsByCharacter: Record<string, string[]>, characterId: string): SkinId[] {
  const owned = ownedSkinsByCharacter[characterId];
  const valid = Array.isArray(owned) ? owned.filter(isSkinId) : [];
  return valid.includes("default") ? valid : ["default", ...valid];
}
