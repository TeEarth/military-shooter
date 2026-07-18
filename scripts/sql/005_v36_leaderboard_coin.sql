-- v36: leaderboard should show how much coin was earned during the SPECIFIC
-- run that set the weekly best wave, not the player's overall coin balance
-- (which was only ever meant as a tiebreaker, not a displayed stat). Run
-- once in the Supabase SQL Editor, same as 001-004.

alter table players add column if not exists weekly_farm_max_wave_coin integer not null default 0;
