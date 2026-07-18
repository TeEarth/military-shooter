-- v38: character color-tint skins — 5 purchasable colors (200 coin each) plus
-- the free "default" (no tint). skin_color is which one is currently equipped;
-- owned_skins is the full unlock list. Run once in the Supabase SQL Editor,
-- same as 001-007.

alter table players add column if not exists skin_color text not null default 'default';
alter table players add column if not exists owned_skins jsonb not null default '["default"]'::jsonb;
