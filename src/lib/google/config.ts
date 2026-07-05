import { getCachedSheet, invalidateSheetCache } from "./cache";
import { appendRow, findRow, updateRow } from "./sheet";

const SETTINGS_SHEET = "Settings";

export async function getSetting(key: string): Promise<string | null> {
  const { rows } = await getCachedSheet(SETTINGS_SHEET);
  const row = rows.find((r) => r.key === key);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const found = await findRow(SETTINGS_SHEET, (r) => r.key === key);
  if (found) {
    await updateRow(SETTINGS_SHEET, found.rowIndex, { value });
  } else {
    await appendRow(SETTINGS_SHEET, { key, value });
  }
  invalidateSheetCache(SETTINGS_SHEET);
}
