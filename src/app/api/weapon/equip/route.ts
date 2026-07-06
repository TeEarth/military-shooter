import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/db/player";
import { getWeaponById } from "@/lib/google/weapon";
import { ownsWeapon, setWeaponEquipped, grantWeaponToPlayer } from "@/lib/db/inventory";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weaponId } = await req.json();

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const owned = await ownsWeapon(player.id, weaponId);

  if (!owned) {
    if (weapon.unlockType !== "FREE") {
      return NextResponse.json({ error: "Weapon not owned" }, { status: 400 });
    }
    // FREE weapons are auto-granted the first time a player tries to equip them.
    await grantWeaponToPlayer(player.id, weaponId);
  }

  await setWeaponEquipped(player.id, weaponId);

  return NextResponse.json({ success: true, message: `${weapon.name} equipped!` });
}
