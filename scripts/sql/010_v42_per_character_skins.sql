-- v42: color skins are now scoped PER CHARACTER instead of shared globally —
-- buying/equipping a color for one character was wrongly affecting every
-- other character (they all read/wrote the same skin_color/owned_skins
-- columns). skin_colors and owned_skins_by_character are both keyed by
-- character id, e.g. {"bob": "red", "jackson": "gold"}. The old global
-- skin_color/owned_skins columns (008_v38_skins.sql) are left in place,
-- unused, rather than dropped. Run once in the Supabase SQL Editor, same as
-- 001-009.

alter table players add column if not exists skin_colors jsonb not null default '{}'::jsonb;
alter table players add column if not exists owned_skins_by_character jsonb not null default '{}'::jsonb;
