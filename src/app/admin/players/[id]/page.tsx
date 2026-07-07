import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getPlayerCharacters, getPlayerWeapons } from "@/lib/db/inventory";
import { getPlayerIncome, getWithdrawalRequests } from "@/lib/db/income";
import AdminPlayerDetailClient from "@/components/admin/AdminPlayerDetailClient";

export default async function AdminPlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isAdmin) redirect("/home");

  const { id } = await params;
  const player = await getPlayerById(id);
  if (!player) notFound();

  const [characters, weapons, income, withdrawals] = await Promise.all([
    getPlayerCharacters(id),
    getPlayerWeapons(id),
    getPlayerIncome(id),
    getWithdrawalRequests(id),
  ]);

  return (
    <AdminPlayerDetailClient
      player={{
        id: player.id,
        username: player.username,
        email: player.email,
        coin: player.coin,
        diamond: player.diamond,
        ticket: player.ticket,
        vipLevel: player.vipLevel,
        vipExp: player.vipExp,
        currentStage: player.currentStage,
        farmStageMaxWave: player.farmStageMaxWave,
        isBanned: player.isBanned,
        isTestAccount: player.isTestAccount,
        createdAt: player.createdAt,
        lastLogin: player.lastLogin,
      }}
      ownedCharacterIds={characters.filter((c) => c.owned).map((c) => c.characterId)}
      ownedWeaponIds={weapons.filter((w) => w.owned).map((w) => w.weaponId)}
      greenBanknoteBalance={income.greenBanknoteBalance}
      withdrawals={withdrawals}
      isOwnAccount={player.id === session.user.id}
    />
  );
}
