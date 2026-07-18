-- v50: two new one-time ticket perks (see src/lib/perks.ts) — Invisible
-- (automatic looping stealth-with-movement, 2s every 15s cooldown) and
-- Never Died (once per run, locks HP at 1 + grants 3s invincibility instead
-- of dying). Ownership flags only, same shape as perk_spare_weapon/
-- perk_regen/perk_super_shield/perk_one_shot from 004_v35_perks.sql. Run
-- once in the Supabase SQL Editor, same as 001-013.

alter table players add column if not exists perk_invisible boolean not null default false;
alter table players add column if not exists perk_never_died boolean not null default false;
