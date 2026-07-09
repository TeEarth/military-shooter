import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getPlayerById } from "@/lib/db/player";
import PvpClient from "@/components/pvp/PvpClient";

export default async function PvpPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const player = await getPlayerById(session.user.id);
  if (!player) redirect("/api/auth/force-logout");

  return <PvpClient playerId={player.id} username={player.username} />;
}
