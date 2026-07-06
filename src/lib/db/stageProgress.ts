import { getSupabaseClient } from "../supabase/client";

const TABLE = "player_stage_progress";

export async function getCompletedStageIds(playerId: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("stage_id").eq("player_id", playerId).eq("completed", true);
  if (error) throw new Error(`getCompletedStageIds: ${error.message}`);
  return (data ?? []).map((r) => r.stage_id);
}

export async function isStageCompleted(playerId: string, stageId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from(TABLE).select("completed").eq("player_id", playerId).eq("stage_id", stageId).maybeSingle();
  if (error) throw new Error(`isStageCompleted: ${error.message}`);
  return Boolean(data?.completed);
}

/** Story stages are locked forever once completed — this only ever sets completed, never clears it. */
export async function markStageCompleted(playerId: string, stageId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from(TABLE).upsert({ player_id: playerId, stage_id: stageId, completed: true });
  if (error) throw new Error(`markStageCompleted: ${error.message}`);
}
