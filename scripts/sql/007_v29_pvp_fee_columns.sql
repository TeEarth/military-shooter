-- v29: the PvP entry fee now gets charged once a match is actually found
-- (see src/app/api/pvp/match/start/route.ts), not at queue-join time —
-- these two flags make the charge idempotent per player per match (so a
-- retried/duplicate match/start call, e.g. on reconnect, never double-charges).
alter table pvp_matches add column if not exists player1_fee_charged boolean not null default false;
alter table pvp_matches add column if not exists player2_fee_charged boolean not null default false;
