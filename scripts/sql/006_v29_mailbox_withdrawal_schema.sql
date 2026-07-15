-- v29: moves the last two pieces of per-player data still living in Google
-- Sheets (Mail, WithdrawalRequest) into Supabase. Both were read on nearly
-- every page load (mailbox badge on Home, mailbox page itself) with no
-- caching layer as robust as the rest of the Supabase-backed data, which is
-- part of why the user reported slow loads.
--
-- Run this once in the Supabase SQL Editor, then the code deployed alongside
-- it reads/writes these tables instead of the "Mail"/"WithdrawalRequest"
-- Google Sheets.

create table if not exists mailbox (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  title text not null,
  message text not null,
  reward text not null default '', -- format "type:amountOrId", e.g. "coin:100"
  claimed boolean not null default false,
  sent_at timestamptz not null default now()
);
create index if not exists idx_mailbox_player on mailbox(player_id);
create index if not exists idx_mailbox_sent_at on mailbox(sent_at);

create table if not exists withdrawal_requests (
  id text primary key,
  player_id text not null,
  amount numeric not null,
  phone text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now()
);
create index if not exists idx_withdrawal_requests_player on withdrawal_requests(player_id);
