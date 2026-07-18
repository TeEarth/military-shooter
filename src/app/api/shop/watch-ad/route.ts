import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlayerById, addCurrency, updatePlayer, toPublicPlayer } from "@/lib/db/player";

const AD_COIN_REWARD = 30;
const DAILY_AD_WATCH_CAP = 10;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "Watch Ad for 30 Coin" on the Trade page — capped per day, same lazy
 *  reset-on-read pattern as the withdrawal cap in src/lib/db/income.ts. */
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const player = await getPlayerById(session.user.id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const today = todayUtc();
  const watchedToday = player.dailyAdCoinDate === today ? player.dailyAdCoinWatches : 0;
  if (watchedToday >= DAILY_AD_WATCH_CAP) {
    return NextResponse.json({ error: `Daily limit reached (${DAILY_AD_WATCH_CAP} ads/day) — come back tomorrow` }, { status: 400 });
  }

  await updatePlayer(player.id, { dailyAdCoinWatches: watchedToday + 1, dailyAdCoinDate: today });
  const updatedPlayer = await addCurrency(player.id, { coin: AD_COIN_REWARD });

  return NextResponse.json({
    success: true,
    reward: AD_COIN_REWARD,
    watchesRemaining: DAILY_AD_WATCH_CAP - (watchedToday + 1),
    updatedPlayer: toPublicPlayer(updatedPlayer),
  });
}
