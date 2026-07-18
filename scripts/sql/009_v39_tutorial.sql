-- v39: first-time tutorial (Training Mode) — tutorial_completed gates whether
-- the tutorial overlay/flow shows at all; tutorial_step is the last state the
-- player reached, so quitting mid-tutorial resumes there instead of
-- restarting from scratch. Run once in the Supabase SQL Editor, same as 001-008.

alter table players add column if not exists tutorial_completed boolean not null default false;
alter table players add column if not exists tutorial_step text not null default 'MOVE';
