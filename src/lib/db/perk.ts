import { getPlayerById, updatePlayer, addCurrency, type Player } from "./player";
import { ownsWeapon } from "./inventory";
import { PERKS, type PerkId } from "../perks";

const PERK_FIELD: Record<PerkId, keyof Pick<Player, "perkSpareWeapon" | "perkRegen" | "perkSuperShield" | "perkOneShot" | "perkInvisible" | "perkNeverDied">> = {
  spare_weapon: "perkSpareWeapon",
  regen: "perkRegen",
  super_shield: "perkSuperShield",
  one_shot: "perkOneShot",
  invisible: "perkInvisible",
  never_died: "perkNeverDied",
};

/** One-time ticket purchase — throws if already owned or short on tickets,
 *  same "load player, check, deduct, persist" shape as upgradePassive(). */
export async function purchasePerk(playerId: string, perkId: PerkId): Promise<Player> {
  const def = PERKS[perkId];
  if (!def) throw new Error("Unknown perk");

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const field = PERK_FIELD[perkId];
  if (player[field]) throw new Error("Perk already owned");
  if (player.ticket < def.cost) throw new Error("Not enough tickets");

  const updated = await addCurrency(playerId, { ticket: -def.cost });
  await updatePlayer(playerId, { [field]: true });
  return { ...updated, [field]: true };
}

/** Sets which owned weapon loads into the swap slot — requires the
 *  spare_weapon perk, the weapon to actually be owned, and that it isn't
 *  just the same weapon already equipped as main (pointless swap target). */
/** v65: weaponId === "" unequips the spare weapon entirely (spareWeaponId's
 *  own "unset" value, see db/player.ts) — skips the ownership/main-weapon
 *  checks below since there's nothing to validate about "no weapon". */
export async function setSpareWeapon(playerId: string, weaponId: string): Promise<void> {
  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");
  if (!player.perkSpareWeapon) throw new Error("Spare Weapon perk not owned");

  if (weaponId !== "") {
    if (weaponId === player.currentWeapon) throw new Error("Spare weapon must be different from your main weapon");
    const owns = await ownsWeapon(playerId, weaponId);
    if (!owns) throw new Error("You don't own that weapon");
  }

  await updatePlayer(playerId, { spareWeaponId: weaponId });
}
