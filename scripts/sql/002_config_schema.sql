-- v13: config-data cache table — fixes the root cause of "still slow" reports
-- after the player-data Supabase migration: every config read (Characters,
-- Weapons, Equipment, Stage, StageEnemy, StageCover, Enemies, PassiveConfig,
-- GachaConfig, CurrencyExchangeConfig, TicketTopUp, VipConfig, BossStage,
-- Mission) was STILL hitting Google Sheets directly (3-11 SECONDS per cold
-- call, measured), because Vercel serverless functions don't reliably keep
-- the in-memory cache (cache.ts's globalThis map) warm between invocations —
-- every request can be a fresh cold start with an empty cache.
--
-- One generic table (not 13 bespoke ones) keyed by (sheet_name, row_index),
-- storing each Sheets row as JSONB — every existing rowToX() mapper already
-- accepts a loosely-typed Record<string, unknown> shape (Number(row.x) works
-- whether row.x is already a number or a string), so no mapper rewrites
-- needed, just swapping the read source.
--
-- Populated by scripts/sync-config-from-sheets.ts (run manually after editing
-- a config Google Sheet — NOT auto-synced per request, per the original plan).
create table if not exists game_config (
  sheet_name text not null,
  row_index integer not null,
  row_data jsonb not null,
  primary key (sheet_name, row_index)
);

create index if not exists idx_game_config_sheet on game_config (sheet_name);
