alter table "PickupSettings"
alter column "readyCheckDurationSeconds" set default 60;

update "PickupSettings"
set
  "readyCheckDurationSeconds" = 60,
  "updatedAt" = now()
where "id" = 'default'
  and "readyCheckDurationSeconds" = 30;
