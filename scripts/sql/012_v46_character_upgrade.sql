-- v46: permanent per-character HP upgrade (uncapped) — keyed by character id,
-- e.g. {"bob": 12, "jackson": 2}. A character never upgraded (or missing
-- entirely from the map) is level 0. Run once in the Supabase SQL Editor,
-- same as 001-011.

alter table players add column if not exists character_upgrade_levels jsonb not null default '{}'::jsonb;
