alter table "PickupSettings"
  add column if not exists "r2AccountId" text,
  add column if not exists "r2BucketName" text,
  add column if not exists "r2PublicBaseUrl" text,
  add column if not exists "r2AccessKeyId" text,
  add column if not exists "r2SecretAccessKey" text;
