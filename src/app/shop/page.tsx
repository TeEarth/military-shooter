import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getAllExchangeRates } from "@/lib/google/exchange";
import { getPlayerIncome } from "@/lib/db/income";
import ShopClient from "@/components/shop/ShopClient";

export default async function ShopPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [rates, income] = await Promise.all([
    getAllExchangeRates(),
    getPlayerIncome(player.id),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const adWatchesToday = player.dailyAdCoinDate === today ? player.dailyAdCoinWatches : 0;

  return (
    <ShopClient
      rates={rates}
      coin={player.coin}
      diamond={player.diamond}
      ticket={player.ticket}
      exp={player.exp}
      greenBanknote={income.greenBanknoteBalance}
      adWatchesToday={adWatchesToday}
    />
  );
}
