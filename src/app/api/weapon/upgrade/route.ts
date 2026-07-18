import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";
import { getWeaponById } from "@/lib/google/weapon";
import { getUpgradedBaseDamage, getWeaponUpgradeCost } from "@/lib/weaponUpgrade";

/** Permanent, uncapped, per-weapon damage upgrade — see src/lib/weaponUpgrade.ts
 *  for the cost/damage formulas (data-driven, not hardcoded per level). */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weaponId } = (await req.json()) as { weaponId: string };
  if (!weaponId) return NextResponse.json({ error: "weaponId required" }, { status: 400 });

  const [player, weapon] = await Promise.all([getPlayerById(session.user.id), getWeaponById(weaponId)]);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const currentLevel = player.weaponUpgradeLevels[weaponId] ?? 0;
  const cost = getWeaponUpgradeCost(currentLevel);
  if (player.coin < cost) return NextResponse.json({ error: "Not enough coin" }, { status: 400 });

  const nextLevel = currentLevel + 1;
  const previousDamage = getUpgradedBaseDamage(weapon.damage, currentLevel);
  const newDamage = getUpgradedBaseDamage(weapon.damage, nextLevel);

  // Grant first, deduct second — a mid-purchase failure can never take payment without delivering the item.
  await updatePlayer(player.id, { weaponUpgradeLevels: { ...player.weaponUpgradeLevels, [weaponId]: nextLevel } });
  let updatedPlayer;
  try {
    updatedPlayer = await addCurrency(player.id, { coin: -cost });
  } catch (e) {
    return NextResponse.json({ error: `Upgrade failed after granting it: ${(e as Error).message}` }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    newLevel: nextLevel,
    newDamage,
    damageGained: newDamage - previousDamage,
    updatedPlayer: toPublicPlayer(updatedPlayer),
  });
}
