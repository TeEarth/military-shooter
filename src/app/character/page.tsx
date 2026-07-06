import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllCharacters } from "@/lib/google/character";
import { getAllWeapons } from "@/lib/google/weapon";
import { getAllPassiveConfigs } from "@/lib/db/passive";
import { getPlayerById } from "@/lib/db/player";
import { getPlayerCharacters, getPlayerWeapons, getEquippedWeaponId } from "@/lib/db/inventory";
import { getPlayerPassives } from "@/lib/db/passive";
import { getPlayerIncome } from "@/lib/db/income";
import CharacterHubClient from "@/components/character/CharacterHubClient";

export default async function CharacterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [allCharacters, allWeapons, passiveConfigs, playerCharacters, playerWeapons, equippedWeaponId, playerPassives, income] = await Promise.all([
    getAllCharacters(),
    getAllWeapons(),
    getAllPassiveConfigs(),
    getPlayerCharacters(player.id),
    getPlayerWeapons(player.id),
    getEquippedWeaponId(player.id),
    getPlayerPassives(player.id),
    getPlayerIncome(player.id),
  ]);

  return (
    <CharacterHubClient
      allCharacters={allCharacters}
      ownedCharacterIds={playerCharacters.filter((c) => c.owned).map((c) => c.characterId)}
      activeCharacterId={player.currentCharacter}
      allWeapons={allWeapons}
      ownedWeaponIds={playerWeapons.filter((w) => w.owned).map((w) => w.weaponId)}
      equippedWeaponId={equippedWeaponId}
      passiveConfigs={passiveConfigs}
      playerPassives={playerPassives}
      currentStage={player.currentStage}
      vipLevel={player.vipLevel}
      farmStageMaxWave={player.farmStageMaxWave}
      coin={player.coin}
      diamond={player.diamond}
      ticket={player.ticket}
      exp={player.exp}
      greenBanknote={income.greenBanknoteBalance}
    />
  );
}
