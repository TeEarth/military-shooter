import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/google/player";
import { getPlayerIncome, getWithdrawalRequests } from "@/lib/google/income";
import { getAllTopUpPackages } from "@/lib/google/topup";
import IncomeClient from "@/components/income/IncomeClient";

export default async function IncomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  const [income, requests, topUpPackages] = await Promise.all([
    getPlayerIncome(player.id),
    getWithdrawalRequests(player.id),
    getAllTopUpPackages(),
  ]);

  return <IncomeClient income={income} requests={requests} topUpPackages={topUpPackages} ticket={player.ticket} />;
}
