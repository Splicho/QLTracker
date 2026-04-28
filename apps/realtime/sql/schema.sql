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

create table if not exists realtime.player_name_history (
  steam_id text not null,
  player_name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_seen_addr text,
  last_seen_server_name text,
  seen_count integer not null default 1,
  primary key (steam_id, player_name)
);

create index if not exists player_name_history_steam_id_last_seen_at_idx
  on realtime.player_name_history (steam_id, last_seen_at desc);

create extension if not exists pgcrypto;

do $$ begin
  create type "PickupLinkSessionStatus" as enum ('pending', 'complete', 'expired', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupLinkSessionFlow" as enum ('launcher', 'browser');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupSeasonStatus" as enum ('draft', 'active', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupSeasonDurationPreset" as enum ('one_month', 'three_month', 'custom');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupMatchStatus" as enum ('ready_check', 'veto', 'provisioning', 'server_ready', 'live', 'completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupReadyState" as enum ('pending', 'ready', 'dropped');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "PickupTeamSide" as enum ('left', 'right');
exception when duplicate_object then null;
end $$;

create table if not exists "PickupPlayer" (
  "id" text primary key,
  "steamId" text not null unique,
  "personaName" text not null,
  "avatarUrl" text,
  "profileUrl" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "lastLoginAt" timestamptz
);

create table if not exists "PickupAppSession" (
  "id" text primary key,
  "playerId" text not null references "PickupPlayer"("id") on delete cascade,
  "tokenHash" text not null unique,
  "expiresAt" timestamptz not null,
  "revokedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "lastUsedAt" timestamptz
);

create index if not exists "PickupAppSession_playerId_idx"
  on "PickupAppSession" ("playerId");

create table if not exists "PickupLinkSession" (
  "id" text primary key,
  "oauthState" text not null unique,
  "flow" "PickupLinkSessionFlow" not null default 'launcher',
  "status" "PickupLinkSessionStatus" not null default 'pending',
  "redirectPath" text,
  "expiresAt" timestamptz not null,
  "appSessionToken" text,
  "errorMessage" text,
  "completedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "playerId" text references "PickupPlayer"("id") on delete set null
);

create index if not exists "PickupLinkSession_status_idx"
  on "PickupLinkSession" ("status");

create index if not exists "PickupLinkSession_flow_idx"
  on "PickupLinkSession" ("flow");

create table if not exists "PickupQueue" (
  "id" text primary key,
  "slug" text not null unique,
  "name" text not null,
  "description" text,
  "teamSize" integer not null default 4,
  "playerCount" integer not null default 8,
  "enabled" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "PickupSettings" (
  "id" text primary key default 'default',
  "readyCheckDurationSeconds" integer not null default 60,
  "vetoTurnDurationSeconds" integer not null default 20,
  "provisionApiUrl" text,
  "provisionAuthToken" text,
  "callbackSecret" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists "PickupSeason" (
  "id" text primary key,
  "queueId" text not null references "PickupQueue"("id") on delete cascade,
  "name" text not null,
  "status" "PickupSeasonStatus" not null default 'draft',
  "durationPreset" "PickupSeasonDurationPreset" not null default 'custom',
  "startingRating" integer not null default 1000,
  "startsAt" timestamptz not null,
  "endsAt" timestamptz not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

alter table "PickupSeason"
  add column if not exists "startingRating" integer not null default 1000;

create index if not exists "PickupSeason_queueId_status_idx"
  on "PickupSeason" ("queueId", "status");

create index if not exists "PickupSeason_startsAt_endsAt_idx"
  on "PickupSeason" ("startsAt", "endsAt");

create table if not exists "PickupRank" (
  "id" text primary key,
  "queueId" text not null references "PickupQueue"("id") on delete cascade,
  "title" text not null,
  "badgeUrl" text,
  "minRating" integer not null,
  "sortOrder" integer not null default 0,
  "active" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("queueId", "minRating"),
  unique ("queueId", "title")
);

create index if not exists "PickupRank_queueId_active_minRating_idx"
  on "PickupRank" ("queueId", "active", "minRating");

create table if not exists "PickupMapPool" (
  "id" text primary key,
  "queueId" text not null references "PickupQueue"("id") on delete cascade,
  "mapKey" text not null,
  "label" text not null,
  "sortOrder" integer not null default 0,
  "active" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("queueId", "mapKey")
);

create table if not exists "PickupQueueMember" (
  "id" text primary key,
  "queueId" text not null references "PickupQueue"("id") on delete cascade,
  "playerId" text not null unique references "PickupPlayer"("id") on delete cascade,
  "joinedAt" timestamptz not null default now(),
  unique ("queueId", "playerId")
);

create index if not exists "PickupQueueMember_queueId_joinedAt_idx"
  on "PickupQueueMember" ("queueId", "joinedAt");

create table if not exists "PickupMatch" (
  "id" text primary key,
  "queueId" text not null references "PickupQueue"("id") on delete cascade,
  "seasonId" text not null references "PickupSeason"("id") on delete cascade,
  "status" "PickupMatchStatus" not null default 'ready_check',
  "readyDeadlineAt" timestamptz,
  "vetoDeadlineAt" timestamptz,
  "currentCaptainPlayerId" text,
  "finalMapKey" text,
  "bannedMapKeys" jsonb,
  "vetoState" jsonb,
  "balanceSummary" jsonb,
  "provisionPayload" jsonb,
  "resultPayload" jsonb,
  "serverIp" text,
  "serverPort" integer,
  "serverJoinAddress" text,
  "serverLocationCountryCode" text,
  "serverLocationCountryName" text,
  "serverProvisionedAt" timestamptz,
  "liveStartedAt" timestamptz,
  "completedAt" timestamptz,
  "winnerTeam" "PickupTeamSide",
  "finalScore" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "PickupMatch_queueId_status_idx"
  on "PickupMatch" ("queueId", "status");

create index if not exists "PickupMatch_seasonId_status_idx"
  on "PickupMatch" ("seasonId", "status");

create table if not exists "PickupMatchPlayer" (
  "id" text primary key,
  "matchId" text not null references "PickupMatch"("id") on delete cascade,
  "playerId" text not null references "PickupPlayer"("id") on delete cascade,
  "joinedAt" timestamptz not null,
  "readyState" "PickupReadyState" not null default 'pending',
  "readyDeadlineAt" timestamptz,
  "readyConfirmedAt" timestamptz,
  "team" "PickupTeamSide",
  "isCaptain" boolean not null default false,
  "muBefore" double precision not null,
  "sigmaBefore" double precision not null,
  "displayBefore" integer not null,
  "muAfter" double precision,
  "sigmaAfter" double precision,
  "displayAfter" integer,
  "won" boolean,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("matchId", "playerId")
);

create index if not exists "PickupMatchPlayer_playerId_createdAt_idx"
  on "PickupMatchPlayer" ("playerId", "createdAt");

create table if not exists "PickupPlayerSeasonRating" (
  "id" text primary key,
  "seasonId" text not null references "PickupSeason"("id") on delete cascade,
  "playerId" text not null references "PickupPlayer"("id") on delete cascade,
  "mu" double precision not null,
  "sigma" double precision not null,
  "displayRating" integer not null,
  "gamesPlayed" integer not null default 0,
  "wins" integer not null default 0,
  "losses" integer not null default 0,
  "seededFrom" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("seasonId", "playerId")
);

create index if not exists "PickupPlayerSeasonRating_seasonId_displayRating_idx"
  on "PickupPlayerSeasonRating" ("seasonId", "displayRating");

create table if not exists "PickupProvisionEvent" (
  "id" text primary key,
  "matchId" text not null references "PickupMatch"("id") on delete cascade,
  "eventType" text not null,
  "payload" jsonb not null,
  "createdAt" timestamptz not null default now()
);

create index if not exists "PickupProvisionEvent_matchId_createdAt_idx"
  on "PickupProvisionEvent" ("matchId", "createdAt");
