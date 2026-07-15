import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById, toPublicPlayer } from "@/lib/db/player";
import { getCharacterById } from "@/lib/google/character";
import { computeVipProgress } from "@/lib/google/vip";
import { getPlayerIncome } from "@/lib/db/income";
import { getMailForPlayer } from "@/lib/google/reward";
import { getEquippedWeaponId } from "@/lib/db/inventory";
import HomeClient from "@/components/home/HomeClient";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [character, vipProgress, income, mail, equippedWeaponId] = await Promise.all([
    getCharacterById(player.currentCharacter),
    computeVipProgress(player.vipExp),
    getPlayerIncome(player.id),
    getMailForPlayer(player.id),
    getEquippedWeaponId(player.id),
  ]);

  const unreadMailCount = mail.filter((m) => !m.claimed).length;

  return (
    <HomeClient
      player={toPublicPlayer(player)}
      characterSprite={character?.sprite ?? ""}
      characterName={character?.name ?? ""}
      equippedWeaponId={equippedWeaponId ?? "pistol"}
      vipProgress={vipProgress}
      greenBanknoteBalance={income.greenBanknoteBalance}
      unreadMailCount={unreadMailCount}
    />
  );
}
