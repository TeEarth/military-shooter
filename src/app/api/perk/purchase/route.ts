import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { purchasePerk } from "@/lib/db/perk";
import { toPublicPlayer } from "@/lib/db/player";
import type { PerkId } from "@/lib/perks";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { perkId } = (await req.json()) as { perkId?: PerkId };
  if (!perkId) return NextResponse.json({ error: "perkId required" }, { status: 400 });

  try {
    const updated = await purchasePerk(session.user.id, perkId);
    return NextResponse.json({ success: true, updatedPlayer: toPublicPlayer(updated) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
