-- v23: schema for real Omise payment top-ups. Run this once in the Supabase
-- SQL Editor, same as 001/002/003/004 — the app code is held back from
-- crediting real currency until this exists.

-- One row per payment attempt (card or PromptPay). The UNIQUE constraint on
-- omise_charge_id IS the anti-duplicate-processing guard — a charge can only
-- ever be credited once, even under webhook redelivery or a double-click.
create table if not exists payment_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id text not null,
  package_id text not null,
  omise_charge_id text unique not null,
  amount_satang integer not null,
  ticket_amount integer not null,
  payment_method text not null,   -- 'card' | 'promptpay'
  status text not null default 'pending', -- 'pending' | 'successful' | 'failed'
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_payment_transactions_player on payment_transactions(player_id);
