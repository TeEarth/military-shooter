-- v47: permanent per-weapon damage upgrade (uncapped) — keyed by weapon id,
-- e.g. {"pistol": 8, "ak47": 2}. A weapon never upgraded (or missing entirely
-- from the map) is level 0. Independent of character_upgrade_levels
-- (012_v46_character_upgrade.sql) — separate system, separate column. Run
-- once in the Supabase SQL Editor, same as 001-012.

alter table players add column if not exists weapon_upgrade_levels jsonb not null default '{}'::jsonb;
