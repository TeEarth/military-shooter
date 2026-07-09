-- v21: schema for real-time 1v1 PvP. Run this once in the Supabase SQL Editor,
-- same as 001/002/003 — the app code for PvP is held back from being wired up
-- until this has been applied (matches this project's existing pattern).

-- Simple FIFO matchmaking queue — a player inserts a row while waiting, the
-- /api/pvp/queue route pairs it with the oldest other waiting row and deletes
-- both once matched. Read/written only via the service-role server client.
create table if not exists pvp_queue (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  username text not null,
  joined_at timestamptz not null default now()
);

-- One row per match. player1/player2 are the two matched player ids;
-- winner_id is set (by /api/pvp/match/complete) once the match ends.
-- status: 'active' | 'done'.
create table if not exists pvp_matches (
  id uuid primary key default gen_random_uuid(),
  player1_id text not null,
  player2_id text not null,
  status text not null default 'active',
  winner_id text,
  created_at timestamptz not null default now()
);

-- Realtime: the waiting client subscribes (browser, anon key) to Postgres
-- Changes on pvp_matches filtered to its own player id, so it's notified the
-- instant a match is created for it instead of polling. That requires the
-- table in the realtime publication AND an RLS policy letting the anon role
-- read it (Realtime enforces RLS on postgres_changes) — match rows have no
-- sensitive data (just player ids/status), so a public SELECT policy is fine.
alter table pvp_matches enable row level security;
drop policy if exists "pvp_matches_select_all" on pvp_matches;
create policy "pvp_matches_select_all" on pvp_matches for select using (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'pvp_matches'
  ) then
    alter publication supabase_realtime add table pvp_matches;
  end if;
end $$;
