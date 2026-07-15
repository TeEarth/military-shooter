import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMatchById, completeMatch } from "@/lib/db/pvp";
import { addCurrency } from "@/lib/db/player";

// v29: PvP now costs a 5-ticket entry fee (see /api/pvp/queue), so payouts
// were reworked around that — winner nets +5 tickets after the fee, and the
// loser gets a diamond consolation instead of walking away with nothing.
const PVP_WIN_TICKET = 10;
const PVP_LOSS_DIAMOND = 10;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { matchId, winnerId } = await req.json();
  if (!matchId || !winnerId) return NextResponse.json({ error: "matchId and winnerId required" }, { status: 400 });

  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.player1Id !== session.user.id && match.player2Id !== session.user.id) {
    return NextResponse.json({ error: "Not a participant in this match" }, { status: 403 });
  }
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    return NextResponse.json({ error: "winnerId isn't a participant in this match" }, { status: 400 });
  }

  // Either side of the match can be the one to report the result first — only
  // whichever call wins that race actually grants the reward, so it's never
  // paid out twice even though both clients call this endpoint.
  const wonRace = await completeMatch(matchId, winnerId);
  if (wonRace) {
    const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id;
    await addCurrency(winnerId, { ticket: PVP_WIN_TICKET });
    await addCurrency(loserId, { diamond: PVP_LOSS_DIAMOND });
  }

  return NextResponse.json({ success: true, rewarded: wonRace });
}
