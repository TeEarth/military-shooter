-- v66: Daily Login Reward — a 7-day repeating weekly cycle (see
-- src/lib/dailyLoginRewards.ts for the reward table, src/lib/db/dailyLogin.ts
-- for the claim logic). daily_login_day is the LAST claimed day (0 = never
-- claimed, so the next claim is day 1) and wraps 7 -> 1 automatically.
-- daily_login_last_claim_date (UTC "YYYY-MM-DD") gates "once per day" —
-- missing a day never resets daily_login_day, the player just claims the
-- next day in sequence whenever they come back. Run once in the Supabase
-- SQL Editor, same as 001-014.

alter table players add column if not exists daily_login_day integer not null default 0;
alter table players add column if not exists daily_login_last_claim_date text not null default '';
