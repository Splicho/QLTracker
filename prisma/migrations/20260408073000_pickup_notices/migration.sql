do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'PickupNoticeVariant'
  ) then
    create type "PickupNoticeVariant" as enum ('success', 'danger', 'alert', 'info');
  end if;
end $$;

create table if not exists "PickupNotice" (
  "id" text not null,
  "content" text not null,
  "linkHref" text,
  "linkLabel" text,
  "dismissable" boolean not null default false,
  "enabled" boolean not null default true,
  "variant" "PickupNoticeVariant" not null default 'info',
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null default current_timestamp,
  constraint "PickupNotice_pkey" primary key ("id")
);

create index if not exists "PickupNotice_enabled_updatedAt_idx"
  on "PickupNotice"("enabled", "updatedAt" desc);
