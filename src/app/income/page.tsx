import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import { getPlayerIncome, getWithdrawalRequests } from "@/lib/db/income";
import { getAllTopUpPackages } from "@/lib/google/topup";
import { getTransactionsForPlayer } from "@/lib/db/payment";
import IncomeClient from "@/components/income/IncomeClient";

export default async function IncomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [income, requests, topUpPackages, transactions] = await Promise.all([
    getPlayerIncome(player.id),
    getWithdrawalRequests(player.id),
    getAllTopUpPackages(),
    getTransactionsForPlayer(player.id),
  ]);

  return <IncomeClient income={income} requests={requests} topUpPackages={topUpPackages} ticket={player.ticket} transactions={transactions} />;
}
