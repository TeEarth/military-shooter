import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";
import { getCharacterById } from "@/lib/google/character";
import { getUpgradeCost, getUpgradedBaseHp } from "@/lib/characterUpgrade";

/** Permanent, uncapped, per-character HP upgrade — see src/lib/characterUpgrade.ts
 *  for the cost/HP formulas (data-driven, not hardcoded per level). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { characterId } = (await req.json()) as { characterId: string };
  if (!characterId) return NextResponse.json({ error: "characterId required" }, { status: 400 });

  const [player, character] = await Promise.all([getPlayerById(session.user.id), getCharacterById(characterId)]);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });

  const currentLevel = player.characterUpgradeLevels[characterId] ?? 0;
  const cost = getUpgradeCost(currentLevel);
  if (player.coin < cost) return NextResponse.json({ error: "Not enough coin" }, { status: 400 });

  const nextLevel = currentLevel + 1;
  const previousHp = getUpgradedBaseHp(character.hpMax, currentLevel);
  const newHp = getUpgradedBaseHp(character.hpMax, nextLevel);

  // Grant first, deduct second — a mid-purchase failure can never take payment without delivering the item.
  await updatePlayer(player.id, { characterUpgradeLevels: { ...player.characterUpgradeLevels, [characterId]: nextLevel } });
  let updatedPlayer;
  try {
    updatedPlayer = await addCurrency(player.id, { coin: -cost });
  } catch (e) {
    return NextResponse.json({ error: `Upgrade failed after granting it: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    newLevel: nextLevel,
    newHp,
    hpGained: newHp - previousHp,
    updatedPlayer: toPublicPlayer(updatedPlayer),
  });
}
