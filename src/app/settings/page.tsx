import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getPlayerCharacters } from "@/lib/db/inventory";
import { getPlayerIncome } from "@/lib/db/income";
import { getAllCharacters, isFreelyUnlocked } from "@/lib/google/character";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [ownedCharacters, income, allCharacters] = await Promise.all([
    getPlayerCharacters(player.id),
    getPlayerIncome(player.id),
    getAllCharacters(),
  ]);

  // v65 fix: a fresh account's starter character ("bob", unlockType FREE) is
  // never written as a real player_character row — it's only "owned" via
  // isFreelyUnlocked(), the same way CharacterHubClient/the character APIs
  // already treat ownership everywhere else. Only counting DB rows here (the
  // old behavior) made Heroes Owned read 0 for every brand-new account.
  const ownedIds = new Set(ownedCharacters.filter((c) => c.owned).map((c) => c.characterId));
  for (const c of allCharacters) {
    if (isFreelyUnlocked(c, player.currentStage)) ownedIds.add(c.id);
  }
  const heroNames = allCharacters.filter((c) => ownedIds.has(c.id)).map((c) => c.name);

  return (
    <SettingsClient
      username={player.username}
      ticket={player.ticket}
      vipLevel={player.vipLevel}
      coin={player.coin}
      diamond={player.diamond}
      greenBanknote={income.greenBanknoteBalance}
      heroNames={heroNames}
      currentStage={player.currentStage}
      farmStageMaxWave={player.farmStageMaxWave}
    />
  );
}
