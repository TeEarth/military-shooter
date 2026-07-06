import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/db/player";
import { getWeaponById } from "@/lib/google/weapon";
import { getRemainingAmmo, refillAmmoViaAd, refillAmmoViaDiamond } from "@/lib/db/weaponAmmo";
import { getPassiveTotals } from "@/lib/db/passive";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const weaponId = new URL(req.url).searchParams.get("weaponId");
  if (!weaponId) return NextResponse.json({ error: "weaponId required" }, { status: 400 });

  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const passives = await getPassiveTotals(session.user.id);
  const effectiveDailyAmmo = Math.round(weapon.dailyAmmo * (1 + passives.dailyAmmoPercent / 100));
  const remaining = await getRemainingAmmo(session.user.id, weaponId, effectiveDailyAmmo);

  return NextResponse.json({ success: true, remaining, dailyAmmo: effectiveDailyAmmo });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weaponId, method } = await req.json();

  const weapon = await getWeaponById(weaponId);
  if (!weapon) return NextResponse.json({ error: "Weapon not found" }, { status: 404 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const passives = await getPassiveTotals(player.id);
  const effectiveDailyAmmo = Math.round(weapon.dailyAmmo * (1 + passives.dailyAmmoPercent / 100));

  try {
    if (method === "ad") {
      const remaining = await refillAmmoViaAd(player.id, weaponId, effectiveDailyAmmo);
      return NextResponse.json({ success: true, remaining });
    }
    if (method === "diamond") {
      const remaining = await refillAmmoViaDiamond(player.id, weaponId, effectiveDailyAmmo);
      return NextResponse.json({ success: true, remaining });
    }
    return NextResponse.json({ error: "Unknown refill method" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
