import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, parseBool } from "./sheet";

const SHEET = "PlayerStageProgress";

export async function getCompletedStageIds(playerId: string): Promise<string[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.filter((r) => r.playerId === playerId && parseBool(r.completed)).map((r) => r.stageId);
}

export async function isStageCompleted(playerId: string, stageId: string): Promise<boolean> {
  const found = await findRow(SHEET, (r) => r.playerId === playerId && r.stageId === stageId);
  return !!found && parseBool(found.row.completed);
}

/** Story stages are locked forever once completed — this only ever sets completed, never clears it. */
export async function markStageCompleted(playerId: string, stageId: string): Promise<void> {
  const found = await findRow(SHEET, (r) => r.playerId === playerId && r.stageId === stageId);
  if (!found) {
    await appendRow(SHEET, { playerId, stageId, completed: true });
    invalidateSheetCache(SHEET);
  }
}
