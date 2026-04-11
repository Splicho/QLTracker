create table "PickupSettings" (
  "id" text not null default 'default',
  "readyCheckDurationSeconds" integer not null default 30,
  "vetoTurnDurationSeconds" integer not null default 20,
  "provisionApiUrl" text,
  "provisionAuthToken" text,
  "callbackSecret" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "PickupSettings_pkey" primary key ("id")
);

insert into "PickupSettings" (
  "id",
  "readyCheckDurationSeconds",
  "vetoTurnDurationSeconds",
  "provisionApiUrl",
  "provisionAuthToken",
  "callbackSecret"
)
values (
  'default',
  coalesce(
    (
      select q."readyCheckDurationSeconds"
      from "PickupQueue" q
      order by
        case when q."slug" = '4v4-ca' then 0 else 1 end,
        q."createdAt" asc
      limit 1
    ),
    30
  ),
  coalesce(
    (
      select q."vetoTurnDurationSeconds"
      from "PickupQueue" q
      order by
        case when q."slug" = '4v4-ca' then 0 else 1 end,
        q."createdAt" asc
      limit 1
    ),
    20
  ),
  (
    select q."provisionApiUrl"
    from "PickupQueue" q
    where q."provisionApiUrl" is not null
    order by
      case when q."slug" = '4v4-ca' then 0 else 1 end,
      q."createdAt" asc
    limit 1
  ),
  (
    select q."provisionAuthToken"
    from "PickupQueue" q
    where q."provisionAuthToken" is not null
    order by
      case when q."slug" = '4v4-ca' then 0 else 1 end,
      q."createdAt" asc
    limit 1
  ),
  (
    select q."callbackSecret"
    from "PickupQueue" q
    where q."callbackSecret" is not null
    order by
      case when q."slug" = '4v4-ca' then 0 else 1 end,
      q."createdAt" asc
    limit 1
  )
)
on conflict ("id") do nothing;

alter table "PickupQueue"
  drop column "readyCheckDurationSeconds",
  drop column "vetoTurnDurationSeconds",
  drop column "provisionApiUrl",
  drop column "provisionAuthToken",
  drop column "callbackSecret";
