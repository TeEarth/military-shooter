-- v45: "Watch Ad for 30 Coin" button on the Trade page — daily count tracked
-- the same lazy-reset way as daily_withdrawn_baht/daily_withdrawn_date. Run
-- once in the Supabase SQL Editor, same as 001-010.

alter table players add column if not exists daily_ad_coin_watches integer not null default 0;
alter table players add column if not exists daily_ad_coin_date text not null default '';
