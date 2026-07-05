/**
 * Single source of truth for equipment/weapon icon paths — every UI that
 * renders an equipment or weapon icon must go through these, not hardcode a
 * generic emoji/placeholder. Equipment ids are already named "{slot}_{rarity}"
 * (e.g. "helmet_epic"), so the path is derived from the id directly rather
 * than trusting whatever's in the Equipment sheet's `sprite` column — that
 * keeps every caller consistent even if sheet data drifts.
 */
export function getEquipmentSprite(equipmentId: string): string {
  return `/assets/sprites/equipment/${equipmentId}.svg`;
}

export function getWeaponSprite(weaponId: string): string {
  return `/assets/sprites/weapons/${weaponId}.svg`;
}
