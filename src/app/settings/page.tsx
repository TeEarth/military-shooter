import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getPlayerCharacters } from "@/lib/db/inventory";
import { getPlayerIncome } from "@/lib/db/income";
import { getAllCharacters } from "@/lib/google/character";
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

  const heroNames = ownedCharacters
    .filter((c) => c.owned)
    .map((c) => allCharacters.find((a) => a.id === c.characterId)?.name ?? c.characterId);

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
