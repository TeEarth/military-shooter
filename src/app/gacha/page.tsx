import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getGachaPools } from "@/lib/google/gacha";
import { getPlayerIncome } from "@/lib/db/income";
import GachaClient from "@/components/gacha/GachaClient";

export default async function GachaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [pools, income] = await Promise.all([
    getGachaPools(),
    getPlayerIncome(player.id),
  ]);
  const poolIds = Array.from(new Set(pools.map((p) => p.poolId)));

  return (
    <GachaClient
      pools={poolIds.map((poolId) => ({
        poolId,
        entries: pools.filter((p) => p.poolId === poolId),
      }))}
      coin={player.coin}
      diamond={player.diamond}
      ticket={player.ticket}
      exp={player.exp}
      greenBanknote={income.greenBanknoteBalance}
    />
  );
}
