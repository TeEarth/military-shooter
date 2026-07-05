import { NextResponse } from "next/server";
import { getAllPlayers } from "@/lib/google/player";

export async function GET() {
  const players = await getAllPlayers();

  const ranked = players
    .filter((p) => !p.isBanned)
    .map((p) => ({ username: p.username, level: p.level, exp: p.exp, score: p.level * 100000 + p.exp }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

  return NextResponse.json({ success: true, data: ranked });
}
