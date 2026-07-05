import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/google/player";
import { getCharacterById } from "@/lib/google/character";
import { getWeaponById } from "@/lib/google/weapon";
import { getEquippedWeaponId } from "@/lib/google/inventory";
import { computeFullStats } from "@/lib/stats";

const DEFAULT_WEAPON_ID = "pistol";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const character = await getCharacterById(player.currentCharacter);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const equippedWeaponId = await getEquippedWeaponId(player.id);
  const weapon = await getWeaponById(equippedWeaponId ?? DEFAULT_WEAPON_ID);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const stats = await computeFullStats(player.id, character, weapon);

  return NextResponse.json({ success: true, data: stats });
}
