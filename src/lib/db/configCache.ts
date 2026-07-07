import { getSupabaseClient } from "../supabase/client";

/**
 * Generic config-row cache, backed by the `game_config` Supabase table
 * (see scripts/sql/002_config_schema.sql) instead of Google Sheets directly.
 *
 * Why this exists: cache.ts's getCachedSheet() looked fine in local dev (a
 * long-lived process keeps its in-memory cache warm), but on Vercel every
 * request can land on a fresh serverless instance with an empty cache —
 * measured cold Sheets reads at 3-11 SECONDS each. Supabase reads are ~10-50x
 * faster even on a cold cache, so this is the real fix, not just "add more
 * caching" — the short in-memory TTL below is a bonus for same-instance
 * request bursts, not the primary latency fix.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  rows: Record<string, string>[];
  fetchedAt: number;
}

// globalThis-backed for the same reason as cache.ts: survives Next.js dev
// hot-reload re-evaluating this module.
const globalForConfigCache = globalThis as unknown as { __configCache?: Map<string, CacheEntry> };
const cache = globalForConfigCache.__configCache ?? (globalForConfigCache.__configCache = new Map());

export async function getConfigRows(sheetName: string, options?: { force?: boolean }): Promise<Record<string, string>[]> {
  const cached = cache.get(sheetName);
  if (!options?.force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rows;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("game_config")
    .select("row_data")
    .eq("sheet_name", sheetName)
    .order("row_index");
  if (error) throw new Error(`getConfigRows(${sheetName}): ${error.message}`);

  const rows = (data ?? []).map((r) => r.row_data as Record<string, string>);
  cache.set(sheetName, { rows, fetchedAt: Date.now() });
  return rows;
}

export function invalidateConfigCache(sheetName?: string): void {
  if (sheetName) cache.delete(sheetName);
  else cache.clear();
}
