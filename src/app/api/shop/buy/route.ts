import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, toPublicPlayer } from "@/lib/db/player";
import { getCharacterById, meetsSpecialRequirements } from "@/lib/google/character";
import { getWeaponById } from "@/lib/google/weapon";
import {
  ownsCharacter as ownsChar,
  ownsWeapon,
  grantWeaponToPlayer,
  unlockCharacterForPlayer,
} from "@/lib/db/inventory";

/**
 * Characters and weapons are still bought directly here. Equipment is NOT —
 * helmets/vests/boots only come from the Gacha (see /api/gacha/pull), so
 * there's no "equipment" itemType branch anymore.
 */

type Currency = "coin" | "diamond" | "ticket";

function priceFor(currency: Currency, prices: { priceCoin: number; priceDiamond: number; priceTicket: number }): number {
  if (currency === "coin") return prices.priceCoin;
  if (currency === "diamond") return prices.priceDiamond;
  return prices.priceTicket;
}

function balanceFor(currency: Currency, player: { coin: number; diamond: number; ticket: number }): number {
  if (currency === "coin") return player.coin;
  if (currency === "diamond") return player.diamond;
  return player.ticket;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemType, itemId, currency } = (await req.json()) as { itemType: string; itemId: string; currency: Currency };

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (itemType === "character") {
    const char = await getCharacterById(itemId);
    if (!char) return NextResponse.json({ error: "Character not found" }, { status: 404 });
    if (await ownsChar(player.id, itemId)) return NextResponse.json({ error: "Already owned" }, { status: 400 });

    if (!meetsSpecialRequirements(char, player.vipLevel, player.farmStageMaxWave)) {
      return NextResponse.json({ error: `Requires VIP ${char.vipRequirement}+ and farm wave > ${char.waveRequirement}` }, { status: 400 });
    }

    // Character unlockValue is the single price, in whichever currency matches unlockType.
    const price = char.unlockValue;
    const expectedCurrency: Currency = char.unlockType === "PURCHASE" ? "coin" : char.unlockType === "DIAMOND" ? "diamond" : "ticket";
    if (currency !== expectedCurrency) return NextResponse.json({ error: `${char.name} is purchased with ${expectedCurrency}` }, { status: 400 });
    if (balanceFor(currency, player) < price) return NextResponse.json({ error: `Not enough ${currency}` }, { status: 400 });

    // Grant first, deduct second — a mid-purchase failure can never take payment without delivering the item.
    try {
      await unlockCharacterForPlayer(player.id, itemId);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }

    let updatedPlayer;
    try {
      updatedPlayer = await addCurrency(player.id, { [currency]: -price } as Record<string, number>);
    } catch (e) {
      return NextResponse.json({ error: `Purchase failed after granting item: ${(e as Error).message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `${char.name} unlocked!`, updatedPlayer: toPublicPlayer(updatedPlayer) });
  }

  if (itemType === "weapon") {
    const weapon = await getWeaponById(itemId);
    if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });
    if (await ownsWeapon(player.id, itemId)) return NextResponse.json({ error: "Already owned" }, { status: 400 });

    // v15: STAGE-type weapons (e.g. Double Pistol) can only be bought once the
    // stage requirement is met — enforced server-side too, not just hidden in
    // the UI, so a direct API call can't skip clearing the stage.
    if (weapon.unlockType === "STAGE" && player.currentStage < weapon.unlockValue) {
      return NextResponse.json({ error: `Unlocks after clearing Stage ${weapon.unlockValue}` }, { status: 400 });
    }
    // v24: FARM_WAVE (e.g. Rasor Gun) — unlocked by the player's all-time best
    // farm wave, from ANY multiverse's farm stage (farmStageMaxWave is a
    // single global field — see src/lib/db/player.ts).
    if (weapon.unlockType === "FARM_WAVE" && player.farmStageMaxWave < weapon.unlockValue) {
      return NextResponse.json({ error: `Unlocks after reaching wave ${weapon.unlockValue} in any Farm stage` }, { status: 400 });
    }

    const price = priceFor(currency, weapon);
    if (price <= 0) return NextResponse.json({ error: `Not purchasable with ${currency}` }, { status: 400 });
    if (balanceFor(currency, player) < price) return NextResponse.json({ error: `Not enough ${currency}` }, { status: 400 });

    try {
      await grantWeaponToPlayer(player.id, itemId);
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }

    let updatedPlayer;
    try {
      updatedPlayer = await addCurrency(player.id, { [currency]: -price } as Record<string, number>);
    } catch (e) {
      return NextResponse.json({ error: `Purchase failed after granting item: ${(e as Error).message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: `${weapon.name} unlocked!`, updatedPlayer: toPublicPlayer(updatedPlayer) });
  }

  return NextResponse.json({ error: "Unknown item type" }, { status: 400 });
}
