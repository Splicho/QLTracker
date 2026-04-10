"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary, useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArrowRight } from "@/components/icon";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchNewsArticleQuery,
  fetchNewsArticlesQuery,
  newsQueryKeys,
} from "@/lib/news-query";
import type { NewsArticleDto } from "@/lib/server/news";

const categoryOrder = [
  "All",
  "Launcher",
  "Pickup",
  "Infrastructure",
  "Community",
] as const;

type CategoryFilter = (typeof categoryOrder)[number];

function toLabel(category: NewsArticleDto["category"]): Exclude<CategoryFilter, "All"> {
  switch (category) {
    case "community":
      return "Community";
    case "infrastructure":
      return "Infrastructure";
    case "launcher":
      return "Launcher";
    case "pickup":
      return "Pickup";
  }
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function NewsImage({
  alt,
  className,
  src,
}: {
  alt: string;
  className?: string;
  src: string | null;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-sm text-white/45 ${className ?? ""}`.trim()}
      >
        No cover image
      </div>
    );
  }

  return <img alt={alt} className={className} src={src} />;
}

function NewsTabs({
  activeCategory,
}: {
  activeCategory: CategoryFilter;
}) {
  const router = useRouter();

  return (
    <Tabs
      className="w-full"
      value={activeCategory}
      onValueChange={(value) => {
        const category = value as CategoryFilter;
        router.push(
          category === "All" ? "/news" : `/news?category=${category.toLowerCase()}`,
        );
      }}
    >
      <TabsList
        aria-label="News categories"
        className="h-auto gap-1 bg-transparent p-0"
        variant="line"
      >
        {categoryOrder.map((category) => (
          <TabsTrigger
            key={category}
            className="h-14 rounded-none px-3 text-sm font-medium text-white/60 hover:text-white data-[state=active]:text-white dark:text-white/60 dark:hover:text-white dark:data-[state=active]:text-white after:bg-white group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
            value={category}
          >
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function NewsFeedInner({
  activeCategory,
}: {
  activeCategory: CategoryFilter;
}) {
  const articlesQuery = useQuery({
    queryKey: newsQueryKeys.articles,
    queryFn: fetchNewsArticlesQuery,
  });

  const articles = articlesQuery.data ?? [];
  const visibleArticles = useMemo(
    () =>
      articles.filter(
        (article) =>
          activeCategory === "All" || toLabel(article.category) === activeCategory,
      ),
    [activeCategory, articles],
  );
  const featuredArticles = visibleArticles.slice(0, 2);
  const listArticles = visibleArticles.slice(2, 12);
  const archivedArticles = visibleArticles.slice(12);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <NewsTabs activeCategory={activeCategory} />
      <h1 className="text-xl font-semibold text-white">QLTracker News</h1>

      {articlesQuery.error instanceof Error ? (
        <p className="text-sm text-rose-300">{articlesQuery.error.message}</p>
      ) : null}

      {!articlesQuery.isLoading && visibleArticles.length === 0 ? (
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-white">No news yet</h2>
          <p className="mt-2 text-sm text-white/60">
            News articles will show up here once they are published.
          </p>
        </div>
      ) : null}

      {featuredArticles.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {featuredArticles.map((article) => (
            <article
              key={article.id}
              className="group relative flex flex-col gap-3 overflow-hidden rounded-[1.25rem] p-3"
            >
              <div className="pointer-events-none absolute inset-0 scale-95 rounded-[1.25rem] bg-white/[0.04] opacity-0 transition duration-300 ease-out group-hover:scale-100 group-hover:opacity-100" />
              <Link
                className="relative cursor-pointer overflow-hidden rounded-lg text-left"
                href={`/news/${article.slug}`}
              >
                <NewsImage
                  alt={article.title}
                  className="h-64 w-full object-cover transition duration-300 group-hover:brightness-125"
                  src={article.coverImageUrl}
                />
              </Link>

              <p className="relative text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
                {toLabel(article.category)}
              </p>
              <p className="relative text-sm text-white/50">
                {formatPublishedAt(article.publishedAt)}
              </p>
              <h2 className="relative text-2xl font-semibold leading-tight text-white">
                {article.title}
              </h2>
              <p className="relative text-sm leading-6 text-white/65">{article.excerpt}</p>
              <Link
                className="relative inline-flex w-fit items-center gap-2 text-sm font-semibold text-white"
                href={`/news/${article.slug}`}
              >
                Read more
                <ArrowRight className="size-4" />
              </Link>
            </article>
          ))}
        </div>
      ) : null}

      {listArticles.length > 0 ? (
        <>
          <div className="h-px bg-white/10" />
          <div className="flex flex-col">
            {listArticles.map((article, index) => (
              <div key={article.id}>
                {index > 0 ? <div className="h-px bg-white/10" /> : null}
                <Link
                  className="flex items-start justify-between gap-6 py-5 transition-opacity hover:opacity-75"
                  href={`/news/${article.slug}`}
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                      <span>{toLabel(article.category)}</span>
                      <span className="h-1 w-1 rounded-full bg-white/35" />
                      <span>{formatPublishedAt(article.publishedAt)}</span>
                    </div>
                    <h3 className="text-lg font-semibold text-white">{article.title}</h3>
                    <p className="max-w-2xl text-sm leading-6 text-white/60">
                      {article.excerpt}
                    </p>
                  </div>

                  <ArrowRight className="mt-1 size-5 shrink-0 text-white/45" />
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {archivedArticles.length > 0 ? (
        <>
          <div className="h-px bg-white/10" />
          <div className="pt-3">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5"
              href="/news/archive"
            >
              Article Archive
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function NewsFeed({
  activeCategory,
  state,
}: {
  activeCategory: CategoryFilter;
  state: DehydratedState;
}) {
  return (
    <HydrationBoundary state={state}>
      <NewsFeedInner activeCategory={activeCategory} />
    </HydrationBoundary>
  );
}

function NewsArchiveInner() {
  const articlesQuery = useQuery({
    queryKey: newsQueryKeys.articles,
    queryFn: fetchNewsArticlesQuery,
  });
  const archivedArticles = (articlesQuery.data ?? []).slice(12);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-white">Article Archive</h1>
        <Link
          className="text-sm font-semibold text-white/70 transition hover:text-white"
          href="/news"
        >
          Back to latest news
        </Link>
      </div>

      {articlesQuery.error instanceof Error ? (
        <p className="text-sm text-rose-300">{articlesQuery.error.message}</p>
      ) : null}

      {archivedArticles.length === 0 ? (
        <p className="text-sm text-white/60">No archived articles yet.</p>
      ) : (
        <div className="flex flex-col">
          {archivedArticles.map((article, index) => (
            <div key={article.id}>
              {index > 0 ? <div className="h-px bg-white/10" /> : null}
              <Link
                className="flex items-start justify-between gap-6 py-5 transition-opacity hover:opacity-75"
                href={`/news/${article.slug}`}
              >
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    <span>{toLabel(article.category)}</span>
                    <span className="h-1 w-1 rounded-full bg-white/35" />
                    <span>{formatPublishedAt(article.publishedAt)}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">{article.title}</h3>
                  <p className="max-w-2xl text-sm leading-6 text-white/60">{article.excerpt}</p>
                </div>

                <ArrowRight className="mt-1 size-5 shrink-0 text-white/45" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewsArchive({ state }: { state: DehydratedState }) {
  return (
    <HydrationBoundary state={state}>
      <NewsArchiveInner />
    </HydrationBoundary>
  );
}

function NewsArticleInner({ slug }: { slug: string }) {
  const articleQuery = useQuery({
    queryKey: newsQueryKeys.article(slug),
    queryFn: () => fetchNewsArticleQuery(slug),
  });

  if (articleQuery.error instanceof Error) {
    return <p className="text-sm text-rose-300">{articleQuery.error.message}</p>;
  }

  const article = articleQuery.data;
  if (!article) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="overflow-hidden rounded-3xl">
        <NewsImage
          alt={article.title}
          className="h-[22rem] w-full object-cover"
          src={article.coverImageUrl}
        />
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
          {toLabel(article.category)}
        </p>
        <p className="text-sm text-white/50">{formatPublishedAt(article.publishedAt)}</p>
        <h1 className="text-3xl font-semibold leading-tight text-white">{article.title}</h1>
        <p className="max-w-3xl text-base leading-7 text-white/60">{article.excerpt}</p>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a(props) {
              return (
                <a
                  {...props}
                  className="text-white underline underline-offset-4"
                  rel="noreferrer"
                  target="_blank"
                />
              );
            },
            h1(props) {
              return <h1 className="mt-6 text-2xl font-semibold text-white" {...props} />;
            },
            h2(props) {
              return <h2 className="mt-6 text-xl font-semibold text-white" {...props} />;
            },
            h3(props) {
              return <h3 className="mt-5 text-lg font-semibold text-white" {...props} />;
            },
            p(props) {
              return <p className="max-w-3xl text-base leading-7 text-white/65" {...props} />;
            },
            ul(props) {
              return <ul className="max-w-3xl list-disc space-y-2 pl-6 text-base text-white/65" {...props} />;
            },
            ol(props) {
              return <ol className="max-w-3xl list-decimal space-y-2 pl-6 text-base text-white/65" {...props} />;
            },
            li(props) {
              return <li className="leading-7" {...props} />;
            },
            code({ className, ...props }) {
              return (
                <code
                  className={`rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] ${className ?? ""}`.trim()}
                  {...props}
                />
              );
            },
            pre(props) {
              return (
                <pre
                  className="max-w-3xl overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
                  {...props}
                />
              );
            },
            img({ alt, src }) {
              return src ? (
                <img alt={alt ?? ""} className="max-w-3xl rounded-2xl object-cover" src={src} />
              ) : null;
            },
          }}
        >
          {article.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function NewsArticlePage({
  slug,
  state,
}: {
  slug: string;
  state: DehydratedState;
}) {
  return (
    <HydrationBoundary state={state}>
      <NewsArticleInner slug={slug} />
    </HydrationBoundary>
  );
}
