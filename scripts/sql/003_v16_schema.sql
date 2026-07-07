-- v16: schema additions for the admin system, weekly leaderboard rewards, and
-- the daily withdrawal cap. Run this once in the Supabase SQL Editor, same as
-- 001/002 — none of the new columns/table below are read/written until this
-- has been applied (the corresponding app code is held back from deploy
-- until confirmed, same pattern as 002_config_schema.sql).

alter table players add column if not exists is_admin boolean not null default false;

-- Weekly leaderboard uses its OWN wave counter, separate from the permanent
-- farm_stage_max_wave (which gates Azzure's unlock and farm_wave missions
-- forever) — resetting farm_stage_max_wave itself weekly would break both of
-- those. weekly_farm_max_wave tracks only "best wave reached since the
-- current leaderboard week started."
alter table players add column if not exists weekly_farm_max_wave integer not null default 0;

-- Daily withdrawal cap (100 baht/day) — same lazy reset-on-read pattern this
-- project already uses for daily ammo/missions: compare daily_withdrawn_date
-- to today, reset daily_withdrawn_baht to 0 if it's stale.
alter table players add column if not exists daily_withdrawn_baht integer not null default 0;
alter table players add column if not exists daily_withdrawn_date text not null default '';

-- Single-row table tracking the current leaderboard week and which week was
-- last paid out — read/updated lazily whenever the leaderboard page loads
-- (no cron needed), same spirit as this project's other daily/weekly resets.
create table if not exists leaderboard_state (
  id integer primary key default 1,
  week_start text not null default '',
  last_rewarded_week text not null default '',
  constraint leaderboard_state_singleton check (id = 1)
);
insert into leaderboard_state (id, week_start, last_rewarded_week)
  values (1, '', '')
  on conflict (id) do nothing;
