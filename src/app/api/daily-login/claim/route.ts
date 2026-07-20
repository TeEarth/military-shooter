import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimDailyLogin } from "@/lib/db/dailyLogin";
import { getPlayerById, toPublicPlayer } from "@/lib/db/player";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await claimDailyLogin(session.user.id);
    const player = await getPlayerById(session.user.id);
    return NextResponse.json({ success: true, result, updatedPlayer: player ? toPublicPlayer(player) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
