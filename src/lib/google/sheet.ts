import { getSheetsClient, getSpreadsheetId } from "./google";

export type SheetRow = Record<string, string>;

/**
 * Google Sheets normalizes boolean values written with USER_ENTERED input as
 * "TRUE"/"FALSE" (uppercase), not the "true"/"false" you'd get from
 * JSON.stringify. Always use this instead of `=== "true"` when reading a
 * boolean cell — a plain string comparison silently reads every TRUE cell as
 * false.
 */
export function parseBool(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

function colLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function isQuotaError(e: unknown): boolean {
  const err = e as { code?: number; status?: number } | undefined;
  return err?.code === 429 || err?.status === 429;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a Sheets API call on a 429 "quota exceeded" error with exponential
 * backoff (500ms/1s/2s) instead of letting it bubble up and break the page —
 * these are rate-limit errors, not permanent failures, so a short wait and
 * retry usually succeeds once the per-minute window rolls over.
 */
async function withQuotaRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [500, 1000, 2000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isQuotaError(e) || attempt === delays.length) throw e;
      await sleep(delays[attempt]);
    }
  }
  throw new Error("unreachable");
}

function parseValuesGrid(values: string[][]): { headers: string[]; rows: SheetRow[] } {
  if (values.length === 0) return { headers: [], rows: [] };

  const headers = values[0].map((h) => String(h).trim());
  const rows: SheetRow[] = values.slice(1)
    .filter((r) => r.some((cell) => cell !== undefined && cell !== ""))
    .map((r) => {
      const obj: SheetRow = {};
      headers.forEach((h, i) => { obj[h] = r[i] !== undefined ? String(r[i]) : ""; });
      return obj;
    });

  return { headers, rows };
}

/** Reads an entire sheet. First row = headers. Returns array of objects keyed by header. */
export async function readSheetRaw(sheetName: string): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await withQuotaRetry(() => sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ10000`,
  }));

  return parseValuesGrid((res.data.values ?? []) as string[][]);
}

/**
 * Reads several sheets in ONE Sheets API call via batchGet — use this instead
 * of calling readSheetRaw() once per sheet when a single page load needs
 * multiple sheets at once (e.g. Home needs Players + Characters + Weapons).
 * Cuts N read-quota hits down to 1 per page load.
 */
export async function readSheetsRaw(sheetNames: string[]): Promise<Record<string, { headers: string[]; rows: SheetRow[] }>> {
  if (sheetNames.length === 0) return {};
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const res = await withQuotaRetry(() => sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: sheetNames.map((name) => `${name}!A1:ZZ10000`),
  }));

  const result: Record<string, { headers: string[]; rows: SheetRow[] }> = {};
  const valueRanges = res.data.valueRanges ?? [];
  sheetNames.forEach((name, i) => {
    result[name] = parseValuesGrid((valueRanges[i]?.values ?? []) as string[][]);
  });
  return result;
}

export async function getHeaders(sheetName: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:ZZ1`,
  });
  return (res.data.values?.[0] ?? []).map((h) => String(h).trim());
}

export async function appendRow(sheetName: string, row: Record<string, string | number | boolean>): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const headers = await getHeaders(sheetName);

  const values = [headers.map((h) => (row[h] !== undefined ? String(row[h]) : ""))];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Appends many rows in a single API call (use this instead of looping appendRow). */
export async function appendRows(sheetName: string, rows: Record<string, string | number | boolean>[]): Promise<void> {
  if (rows.length === 0) return;
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const headers = await getHeaders(sheetName);

  const values = rows.map((row) => headers.map((h) => (row[h] !== undefined ? String(row[h]) : "")));

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** Finds a row (1-based data row index, i.e. sheet row = dataRowIndex + 2) matching predicate. */
export async function findRow(
  sheetName: string,
  predicate: (row: SheetRow) => boolean
): Promise<{ rowIndex: number; row: SheetRow } | null> {
  const { rows } = await readSheetRaw(sheetName);
  const idx = rows.findIndex(predicate);
  if (idx === -1) return null;
  return { rowIndex: idx, row: rows[idx] };
}

export async function findRows(
  sheetName: string,
  predicate: (row: SheetRow) => boolean
): Promise<SheetRow[]> {
  const { rows } = await readSheetRaw(sheetName);
  return rows.filter(predicate);
}

/** Updates a data row (0-based, matching order returned by readSheetRaw) with partial fields. */
export async function updateRow(
  sheetName: string,
  dataRowIndex: number,
  updates: Record<string, string | number | boolean>
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const headers = await getHeaders(sheetName);
  const sheetRowNumber = dataRowIndex + 2; // +1 for header, +1 for 1-based

  const requests: { range: string; values: (string | number)[][] }[] = [];

  for (const [key, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(key);
    if (colIdx === -1) continue;
    const col = colLetter(colIdx);
    requests.push({ range: `${sheetName}!${col}${sheetRowNumber}`, values: [[value as string | number]] });
  }

  if (requests.length === 0) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: requests,
    },
  });
}

export async function deleteRow(sheetName: string, dataRowIndex: number): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  if (!sheet?.properties?.sheetId && sheet?.properties?.sheetId !== 0) throw new Error(`Sheet not found: ${sheetName}`);

  const sheetRowNumber = dataRowIndex + 2;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: "ROWS",
              startIndex: sheetRowNumber - 1,
              endIndex: sheetRowNumber,
            },
          },
        },
      ],
    },
  });
}

/**
 * Deletes every row matching `predicate` from a sheet, keeping all other rows
 * intact — unlike `deleteRow` (single index, shifts on repeated calls), this
 * reads the whole sheet, filters in memory, then rewrites data rows in one
 * batch. Safe for sheets shared across many players (e.g. resetting a single
 * test account's PlayerStageProgress rows without touching anyone else's).
 */
export async function deleteRowsWhere(sheetName: string, predicate: (row: SheetRow) => boolean): Promise<number> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const { headers, rows } = await readSheetRaw(sheetName);
  if (headers.length === 0) return 0;

  const kept = rows.filter((r) => !predicate(r));
  const removedCount = rows.length - kept.length;
  if (removedCount === 0) return 0;

  const values = kept.map((row) => headers.map((h) => (row[h] !== undefined ? String(row[h]) : "")));

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:ZZ10000` });
  if (values.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values },
    });
  }
  return removedCount;
}

export async function ensureSheetExists(sheetName: string, headers: string[]): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetName);

  if (!exists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
    });
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [headers] },
  });
}
