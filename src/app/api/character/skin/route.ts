import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";
import { SKIN_COLOR_PRICE, isSkinColor } from "@/lib/skinColors";

/** Buys or equips a color-tint skin (see src/lib/skinColors.ts) — cosmetic
 *  only, never changes the character's actual sprite/silhouette. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, skinColor } = (await req.json()) as { action: "buy" | "select"; skinColor: string };
  if (!isSkinColor(skinColor)) return NextResponse.json({ error: "Unknown skin color" }, { status: 400 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const owned = player.ownedSkins.includes(skinColor);

  if (action === "buy") {
    if (owned) return NextResponse.json({ error: "Already owned" }, { status: 400 });
    if (player.coin < SKIN_COLOR_PRICE) return NextResponse.json({ error: "Not enough coin" }, { status: 400 });

    // Grant first, deduct second — a mid-purchase failure can never take payment without delivering the item.
    await updatePlayer(player.id, { ownedSkins: [...player.ownedSkins, skinColor] });
    let updatedPlayer;
    try {
      updatedPlayer = await addCurrency(player.id, { coin: -SKIN_COLOR_PRICE });
    } catch (e) {
      return NextResponse.json({ error: `Purchase failed after granting item: ${(e as Error).message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, updatedPlayer: toPublicPlayer(updatedPlayer) });
  }

  if (action === "select") {
    if (!owned) return NextResponse.json({ error: "Skin not owned" }, { status: 400 });
    await updatePlayer(player.id, { skinColor });
    const updatedPlayer = await getPlayerById(player.id);
    return NextResponse.json({ success: true, updatedPlayer: updatedPlayer ? toPublicPlayer(updatedPlayer) : null });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
