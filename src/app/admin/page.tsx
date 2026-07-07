import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllPlayers } from "@/lib/db/player";
import AdminClient from "@/components/admin/AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.isAdmin) redirect("/home");

  const players = await getAllPlayers();

  const playerSummaries = players.map((p) => ({
    id: p.id,
    username: p.username,
    email: p.email,
    coin: p.coin,
    diamond: p.diamond,
    ticket: p.ticket,
    vipLevel: p.vipLevel,
    currentStage: p.currentStage,
    farmStageMaxWave: p.farmStageMaxWave,
    isBanned: p.isBanned,
  }));

  return <AdminClient players={playerSummaries} currentAdminId={session.user.id} />;
}
