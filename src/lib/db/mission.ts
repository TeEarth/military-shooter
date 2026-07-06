import { getSupabaseClient } from "../supabase/client";
import { addCurrency, getPlayerById } from "./player";
// Mission CONFIG (static list + farm-wave formula) is still Google Sheets/code —
// only PlayerMission progress below lives in Supabase.
export { generateFarmWaveMissions, getAllMissions, type MissionRow, type MissionType } from "../google/mission";
import { getAllMissions, generateFarmWaveMissions, type MissionRow } from "../google/mission";

const TABLE = "player_mission";

export async function getAllMissionsForPlayer(playerId: string, farmWaveHint?: number): Promise<MissionRow[]> {
  const staticMissions = await getAllMissions();
  let maxWave = farmWaveHint ?? 0;
  if (farmWaveHint === undefined) {
    const player = await getPlayerById(playerId);
    maxWave = player?.farmStageMaxWave ?? 0;
  }
  return [...staticMissions, ...generateFarmWaveMissions(maxWave)];
}

export interface PlayerMissionRow {
  playerId: string;
  missionId: string;
  progress: number;
  claimed: boolean;
  resetDate: string;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getPlayerMissionProgress(playerId: string): Promise<PlayerMissionRow[]> {
  const [missions, supabase] = [await getAllMissionsForPlayer(playerId), getSupabaseClient()];
  const { data, error } = await supabase.from(TABLE).select("*").eq("player_id", playerId);
  if (error) throw new Error(`getPlayerMissionProgress: ${error.message}`);
  const today = todayUtc();

  return (data ?? []).map((r) => {
    const parsed: PlayerMissionRow = { playerId: r.player_id, missionId: r.mission_id, progress: Number(r.progress ?? 0), claimed: Boolean(r.claimed), resetDate: r.reset_date ?? "" };
    const mission = missions.find((m) => m.id === parsed.missionId);
    if (mission?.type === "daily" && parsed.resetDate !== today) {
      return { ...parsed, progress: 0, claimed: false };
    }
    return parsed;
  });
}

/** Ensures a player's progress row for `mission` reflects "today" if it's a daily mission, resetting it if stale. Returns the up-to-date row. */
async function getOrCreateProgressRow(playerId: string, mission: MissionRow) {
  const supabase = getSupabaseClient();
  const { data: found, error } = await supabase.from(TABLE).select("*").eq("player_id", playerId).eq("mission_id", mission.id).maybeSingle();
  if (error) throw new Error(`getOrCreateProgressRow: ${error.message}`);

  if (!found) {
    const row = { player_id: playerId, mission_id: mission.id, progress: 0, claimed: false, reset_date: todayUtc() };
    const { error: insertError } = await supabase.from(TABLE).insert(row);
    if (insertError) throw new Error(`getOrCreateProgressRow (insert): ${insertError.message}`);
    return row;
  }

  if (mission.type === "daily" && found.reset_date !== todayUtc()) {
    const updated = { progress: 0, claimed: false, reset_date: todayUtc() };
    const { error: updateError } = await supabase.from(TABLE).update(updated).eq("player_id", playerId).eq("mission_id", mission.id);
    if (updateError) throw new Error(`getOrCreateProgressRow (reset): ${updateError.message}`);
    return { ...found, ...updated };
  }

  return found;
}

/** Bumps progress on every mission matching a given metric (e.g. "kills"). Additive — never a "reached X" high-water value. */
export async function incrementMissionProgress(playerId: string, metric: string, amount: number, allMissions?: MissionRow[]): Promise<void> {
  if (amount <= 0) return;
  const missions = allMissions ?? await getAllMissionsForPlayer(playerId);
  const matching = missions.filter((m) => m.metric === metric);
  const supabase = getSupabaseClient();

  for (const mission of matching) {
    const found = await getOrCreateProgressRow(playerId, mission);
    if (!found || found.claimed) continue;
    const newProgress = Math.min(mission.targetValue, Number(found.progress ?? 0) + amount);
    const { error } = await supabase.from(TABLE).update({ progress: newProgress }).eq("player_id", playerId).eq("mission_id", mission.id);
    if (error) throw new Error(`incrementMissionProgress: ${error.message}`);
  }
}

/** Sets progress to max(current, value) (capped at targetValue) for every mission matching `metric` —
 *  for "reached wave/stage X" milestones, where `value` is the new personal-best, not a delta to add. */
export async function setMissionProgressIfHigher(playerId: string, metric: string, value: number, allMissions?: MissionRow[]): Promise<void> {
  if (value <= 0) return;
  const missions = allMissions ?? await getAllMissionsForPlayer(playerId, value);
  const matching = missions.filter((m) => m.metric === metric);
  const supabase = getSupabaseClient();

  for (const mission of matching) {
    const found = await getOrCreateProgressRow(playerId, mission);
    if (!found || found.claimed) continue;
    const current = Number(found.progress ?? 0);
    const next = Math.min(mission.targetValue, Math.max(current, value));
    if (next !== current) {
      const { error } = await supabase.from(TABLE).update({ progress: next }).eq("player_id", playerId).eq("mission_id", mission.id);
      if (error) throw new Error(`setMissionProgressIfHigher: ${error.message}`);
    }
  }
}

export async function claimMission(playerId: string, missionId: string): Promise<{ rewardCoin: number; rewardExp: number; rewardDiamond: number }> {
  const missions = await getAllMissionsForPlayer(playerId);
  const mission = missions.find((m) => m.id === missionId);
  if (!mission) throw new Error("Mission not found");

  const found = await getOrCreateProgressRow(playerId, mission);
  const progress = found ? Number(found.progress ?? 0) : 0;
  const claimed = found ? Boolean(found.claimed) : false;

  if (claimed) throw new Error("Already claimed");
  if (progress < mission.targetValue) throw new Error("Mission not complete yet");

  await addCurrency(playerId, { coin: mission.rewardCoin, exp: mission.rewardExp, diamond: mission.rewardDiamond });

  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, mission_id: missionId, progress: mission.targetValue, claimed: true, reset_date: todayUtc() });
  if (error) throw new Error(`claimMission: ${error.message}`);

  return { rewardCoin: mission.rewardCoin, rewardExp: mission.rewardExp, rewardDiamond: mission.rewardDiamond };
}
