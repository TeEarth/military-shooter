import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAllPlayers } from "@/lib/db/player";
import { sendMail } from "@/lib/google/reward";

const GIFT_TYPES = new Set(["coin", "diamond", "ticket", "banknote"]);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { playerIds, title, message, giftType, giftAmount } = (await req.json()) as {
    playerIds: string[] | "all";
    title: string;
    message: string;
    giftType?: string;
    giftAmount?: number;
  };

  if (!title?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 400 });
  }

  const gift = giftType && GIFT_TYPES.has(giftType) && Number(giftAmount) > 0 ? `${giftType}:${Math.round(Number(giftAmount))}` : "";

  const allPlayers = await getAllPlayers();
  const targets = playerIds === "all" ? allPlayers.map((p) => p.id) : playerIds;
  if (!Array.isArray(targets) || targets.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  await Promise.all(targets.map((id) => sendMail(id, title.trim(), message.trim(), gift)));

  return NextResponse.json({ success: true, sentTo: targets.length });
}
