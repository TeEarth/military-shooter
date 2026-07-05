import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, toPublicPlayer } from "@/lib/google/player";
import { getPlayerCharacters, getPlayerEquipment, getPlayerWeapons } from "@/lib/google/inventory";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const [characters, weapons, equipment] = await Promise.all([
    getPlayerCharacters(player.id),
    getPlayerWeapons(player.id),
    getPlayerEquipment(player.id),
  ]);

  return NextResponse.json({ success: true, data: { ...toPublicPlayer(player), characters, weapons, equipment } });
}
