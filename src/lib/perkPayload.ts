import { getCharacterById } from "./google/character";
import { getWeaponById } from "./google/weapon";
import { getRemainingAmmo } from "./db/weaponAmmo";
import { computeFullStats, statsToLoadout } from "./stats";
import type { Player } from "./db/player";
import type { CombatLoadout } from "@/types/loadout";

/** v35: builds the spare-weapon loadout (null if the perk isn't owned, no
 *  spare is set, or the spare is stale-equal to the current main weapon —
 *  e.g. after re-equipping the same weapon that used to be the spare) plus
 *  the flat perk-ownership flags. Shared by every mode's stage-start route
 *  (story/farm/boss, PvP, tutorial) so perks behave identically everywhere. */
export async function buildPerkPayload(player: Player, weaponId: string) {
  const perks = {
    spareWeapon: player.perkSpareWeapon,
    regen: player.perkRegen,
    superShield: player.perkSuperShield,
    oneShot: player.perkOneShot,
  };

  let spareLoadout: CombatLoadout | null = null;
  if (player.perkSpareWeapon && player.spareWeaponId && player.spareWeaponId !== weaponId) {
    const [spareCharacter, spareWeapon] = await Promise.all([
      getCharacterById(player.currentCharacter),
      getWeaponById(player.spareWeaponId),
    ]);
    if (spareCharacter && spareWeapon) {
      const spareStats = await computeFullStats(player.id, spareCharacter, spareWeapon);
      const spareAmmo = await getRemainingAmmo(player.id, player.spareWeaponId, Math.round(spareStats.dailyAmmo.final));
      spareLoadout = statsToLoadout(spareCharacter, spareWeapon, spareStats, spareAmmo, player.skinColor);
    }
  }

  return { perks, spareLoadout };
}
