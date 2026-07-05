import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById } from "@/lib/google/player";
import { setEquipped, ownsEquipment } from "@/lib/google/inventory";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { equipmentId, equipped } = await req.json();

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  if (!(await ownsEquipment(player.id, equipmentId))) {
    return NextResponse.json({ error: "Equipment not owned" }, { status: 400 });
  }

  try {
    await setEquipped(player.id, equipmentId, Boolean(equipped));
    return NextResponse.json({ success: true, message: equipped ? "Equipped!" : "Unequipped." });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
