do $$ begin
  create type "NewsArticleCategory" as enum ('launcher', 'pickup', 'infrastructure', 'community');
exception when duplicate_object then null;
end $$;

create table if not exists "NewsArticle" (
  "id" text primary key,
  "slug" text not null unique,
  "title" text not null,
  "excerpt" text not null,
  "content" text not null,
  "category" "NewsArticleCategory" not null,
  "coverImageUrl" text,
  "publishedAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "NewsArticle_publishedAt_idx"
  on "NewsArticle" ("publishedAt" desc);

create index if not exists "NewsArticle_category_publishedAt_idx"
  on "NewsArticle" ("category", "publishedAt" desc);
