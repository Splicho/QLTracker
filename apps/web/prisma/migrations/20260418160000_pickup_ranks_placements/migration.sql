-- Add queue-specific pickup ranks and configurable season starting ratings.

alter table "PickupSeason"
  add column "startingRating" integer not null default 1000;

create table "PickupRank" (
  "id" text not null,
  "queueId" text not null,
  "title" text not null,
  "badgeUrl" text,
  "minRating" integer not null,
  "sortOrder" integer not null default 0,
  "active" boolean not null default true,
  "createdAt" timestamp(3) not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) not null,

  constraint "PickupRank_pkey" primary key ("id")
);

create unique index "PickupRank_queueId_minRating_key"
  on "PickupRank"("queueId", "minRating");

create unique index "PickupRank_queueId_title_key"
  on "PickupRank"("queueId", "title");

create index "PickupRank_queueId_active_minRating_idx"
  on "PickupRank"("queueId", "active", "minRating");

alter table "PickupRank"
  add constraint "PickupRank_queueId_fkey"
  foreign key ("queueId") references "PickupQueue"("id") on delete cascade on update cascade;
