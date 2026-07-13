import { getSupabaseClient } from "../supabase/client";

const QUEUE_TABLE = "pvp_queue";
const MATCH_TABLE = "pvp_matches";

export interface PvpMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  status: "active" | "done";
  winnerId: string | null;
  createdAt: string;
}

function rowToMatch(row: Record<string, unknown>): PvpMatch {
  return {
    id: String(row.id),
    player1Id: String(row.player1_id),
    player2Id: String(row.player2_id),
    status: (row.status as PvpMatch["status"]) ?? "active",
    winnerId: (row.winner_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

/**
 * Joins the matchmaking queue and immediately tries to pair with whoever's
 * been waiting longest. Returns the created match if a pair was found (either
 * because THIS call found an existing waiter, or — rare race — another
 * player's call already matched this player first), or null if this player is
 * now the one waiting (the OTHER player's subsequent queue call, or their
 * Realtime subscription on pvp_matches, is what completes the match).
 */
export async function joinQueue(playerId: string, username: string): Promise<PvpMatch | null> {
  const supabase = getSupabaseClient();

  // Already matched by someone else's queue call in the meantime (e.g. this
  // player queued, someone matched them, then called joinQueue again before
  // seeing the Realtime notification) — hand back the existing active match
  // instead of creating a duplicate.
  const existing = await getActiveMatchForPlayer(playerId);
  if (existing) return existing;

  // Never double-queue the same player.
  await supabase.from(QUEUE_TABLE).delete().eq("player_id", playerId);

  const { data: waiting, error: findError } = await supabase
    .from(QUEUE_TABLE)
    .select("*")
    .neq("player_id", playerId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (findError) throw new Error(`joinQueue (find waiting): ${findError.message}`);

  if (!waiting) {
    const { error: insertError } = await supabase.from(QUEUE_TABLE).insert({ player_id: playerId, username });
    if (insertError) throw new Error(`joinQueue (insert): ${insertError.message}`);
    return null;
  }

  // Found an opponent — create the match and remove both from the queue.
  const { data: match, error: matchError } = await supabase
    .from(MATCH_TABLE)
    .insert({ player1_id: waiting.player_id, player2_id: playerId, status: "active" })
    .select("*")
    .single();
  if (matchError) throw new Error(`joinQueue (create match): ${matchError.message}`);

  const { error: deleteError } = await supabase.from(QUEUE_TABLE).delete().in("player_id", [playerId, waiting.player_id]);
  if (deleteError) throw new Error(`joinQueue (clear queue): ${deleteError.message}`);

  return rowToMatch(match);
}

export async function leaveQueue(playerId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(QUEUE_TABLE).delete().eq("player_id", playerId);
  if (error) throw new Error(`leaveQueue: ${error.message}`);
}

// v25 fix: confirmed live (via two real accounts) that a match abandoned by
// either side — tab closed, connection dropped, or just navigating away —
// stays "active" forever, since nothing ever calls completeMatch() for it.
// getActiveMatchForPlayer kept handing that same dead match back to either
// original participant on every future joinQueue call, permanently blocking
// them from ever being paired with anyone else again — the "opponent doesn't
// respond" symptom was really "you're matched against a session that isn't
// there anymore," not a sync bug in the live match itself. Anything still
// "active" past this window is almost certainly abandoned, not a genuinely
// ongoing match, so it's treated as stale and closed out here instead of
// being returned.
const STALE_MATCH_MS = 10 * 60 * 1000;

export async function getActiveMatchForPlayer(playerId: string): Promise<PvpMatch | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(MATCH_TABLE)
    .select("*")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveMatchForPlayer: ${error.message}`);
  if (!data) return null;

  const match = rowToMatch(data);
  if (Date.now() - new Date(match.createdAt).getTime() > STALE_MATCH_MS) {
    await supabase.from(MATCH_TABLE).update({ status: "done" }).eq("id", match.id).eq("status", "active");
    return null;
  }
  return match;
}

export async function getMatchById(matchId: string): Promise<PvpMatch | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(MATCH_TABLE).select("*").eq("id", matchId).maybeSingle();
  if (error) throw new Error(`getMatchById: ${error.message}`);
  return data ? rowToMatch(data) : null;
}

/**
 * Marks a match done and records the winner — only the two participants may
 * call this (enforced by the caller, /api/pvp/match/complete). Either side of
 * the match may report the result first (there's no dedicated authoritative
 * server); the `.eq("status", "active")` guard means only the FIRST call
 * actually flips the row, so this returns whether THIS call was the one that
 * won that race — the caller uses that to decide whether to grant the reward,
 * preventing both clients from granting it twice.
 */
export async function completeMatch(matchId: string, winnerId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(MATCH_TABLE)
    .update({ status: "done", winner_id: winnerId })
    .eq("id", matchId)
    .eq("status", "active")
    .select("id");
  if (error) throw new Error(`completeMatch: ${error.message}`);
  return (data?.length ?? 0) > 0;
}
