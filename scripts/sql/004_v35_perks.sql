-- v35: Perk system — 4 fixed one-time-purchase perks (ticket currency), not
-- sheet-driven like passives since the catalog is small and fixed. Ownership
-- is a plain boolean per perk on players; spare_weapon_id is which OWNED
-- weapon (other than current_weapon) is loaded into the swap slot once
-- perk_spare_weapon is owned. Run once in the Supabase SQL Editor, same as
-- 001/002/003 — held back from deploy until confirmed run.

alter table players add column if not exists perk_spare_weapon boolean not null default false;
alter table players add column if not exists perk_regen boolean not null default false;
alter table players add column if not exists perk_super_shield boolean not null default false;
alter table players add column if not exists perk_one_shot boolean not null default false;
alter table players add column if not exists spare_weapon_id text not null default '';
