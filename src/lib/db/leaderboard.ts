import { getSupabaseClient } from "../supabase/client";
import { getAllPlayers, type Player } from "./player";
import { addGreenBanknotes } from "./income";
import { sendMail } from "../google/reward";

// v16: requires scripts/sql/003_v16_schema.sql (players.weekly_farm_max_wave,
// the leaderboard_state table) — held back from deploy until confirmed run.

const STATE_TABLE = "leaderboard_state";
const TOP3_BANKNOTES = [20, 10, 5];

/** ISO week (Monday-start, UTC) as a YYYY-MM-DD date string — used purely as
 *  a comparison key to detect "a new week has started since we last checked",
 *  not for display. */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun..6=Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  return monday.toISOString().slice(0, 10);
}

interface LeaderboardState {
  weekStart: string;
  lastRewardedWeek: string;
}

async function getState(): Promise<LeaderboardState> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(STATE_TABLE).select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`getLeaderboardState: ${error.message}`);
  return { weekStart: data?.week_start ?? "", lastRewardedWeek: data?.last_rewarded_week ?? "" };
}

async function setState(weekStart: string, lastRewardedWeek: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(STATE_TABLE).upsert({ id: 1, week_start: weekStart, last_rewarded_week: lastRewardedWeek });
  if (error) throw new Error(`setLeaderboardState: ${error.message}`);
}

/** Mails green-banknote rewards to the top 3 of the week that just ended —
 *  claimed from the mailbox like every other reward, not granted silently. */
async function finalizeWeeklyRewards(players: Player[], endedWeek: string): Promise<void> {
  const ranked = players
    .filter((p) => !p.isBanned && p.weeklyFarmMaxWave > 0)
    .sort((a, b) => b.weeklyFarmMaxWave - a.weeklyFarmMaxWave || b.coin - a.coin)
    .slice(0, 3);

  for (let i = 0; i < ranked.length; i++) {
    const banknote = TOP3_BANKNOTES[i];
    await sendMail(
      ranked[i].id,
      "Leaderboard Reward",
      `You placed #${i + 1} on the Farm Stage leaderboard for the week of ${endedWeek} (best wave ${ranked[i].weeklyFarmMaxWave})!`,
      `banknote:${banknote}`
    );
  }
}

async function resetAllWeeklyWaves(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("players").update({ weekly_farm_max_wave: 0 }).gt("weekly_farm_max_wave", 0);
  if (error) throw new Error(`resetAllWeeklyWaves: ${error.message}`);
}

export interface LeaderboardEntry {
  username: string;
  wave: number;
  /** v36: coin earned during the specific run that set this wave record —
   *  not the player's overall balance (see recordWeeklyFarmWave). */
  coin: number;
}

/** Ranks players by highest farm-stage wave reached THIS leaderboard week.
 *  Lazily rolls the week over (finalizes previous week's top-3 mail rewards,
 *  resets everyone's counter) the first time this is called after a week
 *  boundary has passed — same lazy reset-on-read pattern this project
 *  already uses for daily ammo/mission resets, just weekly. */
export async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[]; weekStart: string }> {
  const state = await getState();
  const thisWeek = currentWeekStart();

  if (state.weekStart !== thisWeek) {
    if (state.weekStart && state.lastRewardedWeek !== state.weekStart) {
      const players = await getAllPlayers();
      await finalizeWeeklyRewards(players, state.weekStart);
    }
    await resetAllWeeklyWaves();
    await setState(thisWeek, state.weekStart || thisWeek);
  }

  const players = await getAllPlayers();
  const entries = players
    .filter((p) => !p.isBanned && p.weeklyFarmMaxWave > 0)
    .map((p) => ({ username: p.username, wave: p.weeklyFarmMaxWave, coin: p.weeklyFarmMaxWaveCoin }))
    // Ties on wave are broken by that same run's coin — whoever earned more ranks higher.
    .sort((a, b) => b.wave - a.wave || b.coin - a.coin)
    .slice(0, 50);

  return { entries, weekStart: thisWeek };
}

/** Records a new personal-best farm wave for THIS leaderboard week — call
 *  alongside recordFarmWave (the permanent, never-reset record) whenever a
 *  farm run ends. `coinThisRun` (killCoin earned during that specific run,
 *  not the player's balance) is stored alongside it so the leaderboard shows
 *  what was actually earned reaching that wave, not an unrelated total. */
export async function recordWeeklyFarmWave(playerId: string, waveReached: number, coinThisRun: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("players").select("weekly_farm_max_wave").eq("id", playerId).maybeSingle();
  if (error) throw new Error(`recordWeeklyFarmWave (read): ${error.message}`);
  const current = Number(data?.weekly_farm_max_wave ?? 0);
  if (waveReached > current) {
    const { error: updateError } = await supabase.from("players").update({ weekly_farm_max_wave: waveReached, weekly_farm_max_wave_coin: Math.round(coinThisRun) }).eq("id", playerId);
    if (updateError) throw new Error(`recordWeeklyFarmWave (write): ${updateError.message}`);
  }
}
