import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { setSpareWeapon } from "@/lib/db/perk";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weaponId } = (await req.json()) as { weaponId?: string };
  if (weaponId === undefined) return NextResponse.json({ error: "weaponId required" }, { status: 400 });

  try {
    await setSpareWeapon(session.user.id, weaponId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
