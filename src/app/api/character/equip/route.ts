import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, updatePlayer } from "@/lib/db/player";
import { getCharacterById, isFreelyUnlocked } from "@/lib/google/character";
import { ownsCharacter } from "@/lib/db/inventory";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = await req.json();

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const character = await getCharacterById(characterId);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const unlockedFree = isFreelyUnlocked(character, player.currentStage);
  const owned = await ownsCharacter(player.id, characterId);

  if (!unlockedFree && !owned) {
    return NextResponse.json({ error: "Character not owned" }, { status: 400 });
  }

  await updatePlayer(player.id, { currentCharacter: characterId });

  return NextResponse.json({ success: true, message: `${character.name} equipped!` });
}
