import { readSheetRaw, readSheetsRaw, type SheetRow } from "./sheet";

const DEFAULT_TTL_MS = 90_000;

/**
 * v8 #1: sheets that almost never change mid-day (game-balance data) get a
 * much longer TTL than player-state sheets, cutting a big chunk of redundant
 * read-quota usage. Players/progress sheets stay closer to real-time since
 * currency/quest/stage state changes constantly during play.
 */
const SHEET_TTL_MS: Record<string, number> = {
  Characters: 300_000,
  Weapons: 300_000,
  Equipment: 300_000,
  Stage: 300_000,
  StageEnemy: 300_000,
  Enemies: 300_000,
  PassiveConfig: 300_000,
  GachaConfig: 300_000,
  CurrencyExchangeConfig: 300_000,
  TicketTopUp: 300_000,
  BossStage: 300_000,
  Mission: 180_000,
  Settings: 300_000,
};

function ttlFor(sheetName: string): number {
  return SHEET_TTL_MS[sheetName] ?? DEFAULT_TTL_MS;
}

interface CacheEntry {
  headers: string[];
  rows: SheetRow[];
  fetchedAt: number;
}

// Kept on globalThis (not a module-level const) specifically because Next.js
// dev-mode hot-reload re-evaluates route modules on every edit — a plain
// module-level Map would get thrown away and recreated on each hot reload,
// silently defeating the cache and hammering the Sheets API exactly like
// having no cache at all. globalThis survives across those re-evaluations
// within the same Node process.
const globalForCache = globalThis as unknown as { __sheetCache?: Map<string, CacheEntry>; __sheetInflight?: Map<string, Promise<CacheEntry>> };

const cache = globalForCache.__sheetCache ?? (globalForCache.__sheetCache = new Map());
const inflight = globalForCache.__sheetInflight ?? (globalForCache.__sheetInflight = new Map());

async function fetchFresh(sheetName: string): Promise<CacheEntry> {
  const { headers, rows } = await readSheetRaw(sheetName);
  const entry: CacheEntry = { headers, rows, fetchedAt: Date.now() };
  cache.set(sheetName, entry);
  return entry;
}

/**
 * Returns cached rows for a sheet, refreshing from Google Sheets if the
 * sheet-specific TTL has elapsed (see SHEET_TTL_MS). Pass `force: true` to
 * bypass the TTL and always hit the Sheets API — use sparingly (e.g. a
 * "browse latest balance" screen), not on every request.
 */
export async function getCachedSheet(sheetName: string, options?: { force?: boolean }): Promise<{ headers: string[]; rows: SheetRow[] }> {
  const existing = cache.get(sheetName);
  if (!options?.force && existing && Date.now() - existing.fetchedAt < ttlFor(sheetName)) {
    return existing;
  }

  const pending = inflight.get(sheetName);
  if (pending && !options?.force) return pending;

  const promise = fetchFresh(sheetName).finally(() => inflight.delete(sheetName));
  inflight.set(sheetName, promise);
  return promise;
}

/**
 * Batch-aware multi-sheet read — use this when a single page load needs
 * several sheets at once (e.g. Home needs Players + Characters + Weapons).
 * Sheets that are still fresh in cache are served from cache; only the stale
 * ones are fetched, and if more than one needs fetching they're combined into
 * a SINGLE batchGet call instead of one readSheetRaw per sheet.
 */
export async function getCachedSheets(sheetNames: string[]): Promise<Record<string, { headers: string[]; rows: SheetRow[] }>> {
  const result: Record<string, { headers: string[]; rows: SheetRow[] }> = {};
  const stale: string[] = [];

  for (const name of sheetNames) {
    const existing = cache.get(name);
    if (existing && Date.now() - existing.fetchedAt < ttlFor(name)) {
      result[name] = existing;
    } else {
      stale.push(name);
    }
  }

  if (stale.length === 1) {
    result[stale[0]] = await getCachedSheet(stale[0]);
  } else if (stale.length > 1) {
    const fetched = await readSheetsRaw(stale);
    const fetchedAt = Date.now();
    for (const name of stale) {
      const entry: CacheEntry = { ...fetched[name], fetchedAt };
      cache.set(name, entry);
      result[name] = entry;
    }
  }

  return result;
}

/** Call after any write to a sheet so the next read is forced fresh. */
export function invalidateSheetCache(sheetName: string): void {
  cache.delete(sheetName);
}

export function invalidateAllCache(): void {
  cache.clear();
}
