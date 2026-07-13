import { getSupabaseClient } from "../supabase/client";
// BossStage config is game-balance data — still Google Sheets. Only the
// per-player bossEncounterCount below lives in Supabase.
export { getAllBossStageConfigs, getBossPacing, getBossConfigForEncounter, type BossStageRow } from "../google/bossStage";

const TABLE = "player_boss_progress";

export async function getBossEncounterCount(playerId: string): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("boss_encounter_count").eq("player_id", playerId).maybeSingle();
  if (error) throw new Error(`getBossEncounterCount: ${error.message}`);
  return Number(data?.boss_encounter_count ?? 0);
}

export async function incrementBossEncounterCount(playerId: string): Promise<number> {
  const current = await getBossEncounterCount(playerId);
  const next = current + 1;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, boss_encounter_count: next });
  if (error) throw new Error(`incrementBossEncounterCount: ${error.message}`);
  return next;
}
