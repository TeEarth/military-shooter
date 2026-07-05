import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import GameClient from "@/components/game/GameClient";

export default async function GamePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <GameClient />;
}
