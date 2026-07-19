import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";
import { SKIN_PRICE, isSkinId, getOwnedSkins } from "@/lib/characterSkins";
import { getCharacterById, isFreelyUnlocked } from "@/lib/google/character";
import { ownsCharacter } from "@/lib/db/inventory";

/** Buys or equips a real sprite-asset skin (see src/lib/characterSkins.ts) —
 *  each skin id resolves to its own SVG file, no tint/overlay involved.
 *  v42: ownership/equip is scoped PER characterId — buying/equipping a skin
 *  for one character must never touch any other character's own skin state. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, skinId, characterId } = (await req.json()) as { action: "buy" | "select"; skinId: string; characterId: string };
  if (!isSkinId(skinId)) return NextResponse.json({ error: "Unknown skin" }, { status: 400 });
  if (!characterId) return NextResponse.json({ error: "characterId required" }, { status: 400 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const character = await getCharacterById(characterId);
  if (!character) return NextResponse.json({ error: "Character not found" }, { status: 404 });
  const characterOwned = isFreelyUnlocked(character, player.currentStage) || (await ownsCharacter(player.id, characterId));
  if (!characterOwned) return NextResponse.json({ error: "Character not owned" }, { status: 403 });

  const ownedForCharacter = getOwnedSkins(player.ownedSkinsByCharacter, characterId);
  const owned = ownedForCharacter.includes(skinId);
  const price = SKIN_PRICE[skinId];

  if (action === "buy") {
    if (owned) return NextResponse.json({ error: "Already owned" }, { status: 400 });
    if (!price) return NextResponse.json({ error: "This skin is free" }, { status: 400 });
    const balance = price.currency === "coin" ? player.coin : player.diamond;
    if (balance < price.amount) return NextResponse.json({ error: `Not enough ${price.currency}` }, { status: 400 });

    // Grant first, deduct second — a mid-purchase failure can never take payment without delivering the item.
    // Only THIS character's entry in the map is touched — every other character's array is passed through untouched.
    await updatePlayer(player.id, {
      ownedSkinsByCharacter: { ...player.ownedSkinsByCharacter, [characterId]: [...ownedForCharacter, skinId] },
    });
    let updatedPlayer;
    try {
      updatedPlayer = await addCurrency(player.id, { [price.currency]: -price.amount });
    } catch (e) {
      return NextResponse.json({ error: `Purchase failed after granting item: ${(e as Error).message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, updatedPlayer: toPublicPlayer(updatedPlayer) });
  }

  if (action === "select") {
    if (!owned) return NextResponse.json({ error: "Skin not owned" }, { status: 400 });
    await updatePlayer(player.id, { skinColors: { ...player.skinColors, [characterId]: skinId } });
    const updatedPlayer = await getPlayerById(player.id);
    return NextResponse.json({ success: true, updatedPlayer: updatedPlayer ? toPublicPlayer(updatedPlayer) : null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
