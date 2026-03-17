create schema if not exists realtime;

create table if not exists realtime.server_snapshots (
  addr text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists server_snapshots_updated_at_idx
  on realtime.server_snapshots (updated_at desc);

create table if not exists realtime.server_history_samples (
  addr text not null,
  sampled_at timestamptz not null,
  players integer not null,
  max_players integer not null,
  map text,
  game_mode text,
  primary key (addr, sampled_at)
);

create index if not exists server_history_samples_addr_sampled_at_idx
  on realtime.server_history_samples (addr, sampled_at desc);

create index if not exists server_history_samples_sampled_at_idx
  on realtime.server_history_samples (sampled_at desc);
