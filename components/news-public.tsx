"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { remarkMdx } from "@platejs/markdown"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { ArrowLeft, ArrowRight, ArrowUpRight } from "@/components/icon"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchNewsArticleQuery,
  fetchNewsArticlesQuery,
  newsQueryKeys,
} from "@/lib/news-query"
import type { NewsArticleDto } from "@/lib/server/news"
import { cn } from "@/lib/utils"

const categoryOrder = [
  "All",
  "Launcher",
  "Pickup",
  "Infrastructure",
  "Community",
] as const

type CategoryFilter = (typeof categoryOrder)[number]

function toLabel(
  category: NewsArticleDto["category"]
): Exclude<CategoryFilter, "All"> {
  switch (category) {
    case "community":
      return "Community"
    case "infrastructure":
      return "Infrastructure"
    case "launcher":
      return "Launcher"
    case "pickup":
      return "Pickup"
  }
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value))
}

function NewsArticleMetaRow({
  category,
  className,
  publishedAt,
}: {
  category: NewsArticleDto["category"]
  className?: string
  publishedAt: string
}) {
  return (
    <p className={cn("flex flex-wrap items-center gap-3 text-sm", className)}>
      <span className="font-semibold text-white/55 uppercase">
        {toLabel(category)}
      </span>
      <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-white/35" />
      <span className="font-normal text-white/50 normal-case">
        {formatPublishedAt(publishedAt)}
      </span>
    </p>
  )
}

function NewsImage({
  alt,
  className,
  src,
}: {
  alt: string
  className?: string
  src: string | null
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-white/5 text-sm text-white/45 ${className ?? ""}`.trim()}
      >
        No cover image
      </div>
    )
  }

  return <img alt={alt} className={className} src={src} />
}

function NewsTabs({ activeCategory }: { activeCategory: CategoryFilter }) {
  const router = useRouter()

  return (
    <Tabs
      className="w-full"
      value={activeCategory}
      onValueChange={(value) => {
        const category = value as CategoryFilter
        router.push(
          category === "All"
            ? "/news"
            : `/news?category=${category.toLowerCase()}`
        )
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
            className="h-14 rounded-none px-3 text-sm font-medium text-white/60 after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] hover:text-white data-[state=active]:text-white dark:text-white/60 dark:hover:text-white dark:data-[state=active]:text-white"
            value={category}
          >
            {category}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}

function NewsFeedInner({
  activeCategory,
  initialArticles,
}: {
  activeCategory: CategoryFilter
  initialArticles: NewsArticleDto[]
}) {
  const articlesQuery = useQuery({
    queryKey: newsQueryKeys.articles,
    queryFn: fetchNewsArticlesQuery,
    initialData: initialArticles,
    staleTime: 60_000,
  })

  const visibleArticles = useMemo(
    () =>
      (articlesQuery.data ?? []).filter(
        (article) =>
          activeCategory === "All" ||
          toLabel(article.category) === activeCategory
      ),
    [activeCategory, articlesQuery.data]
  )
  const featuredArticles = visibleArticles.slice(0, 2)
  const listArticles = visibleArticles.slice(2, 12)
  const archivedArticles = visibleArticles.slice(12)

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

              <NewsArticleMetaRow
                category={article.category}
                className="relative"
                publishedAt={article.publishedAt}
              />
              <h2 className="relative text-2xl leading-tight font-semibold text-white">
                {article.title}
              </h2>
              <p className="relative text-sm leading-6 text-white/65">
                {article.excerpt}
              </p>
              <Link
                className="relative mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-white"
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
                    <NewsArticleMetaRow
                      category={article.category}
                      className="text-xs"
                      publishedAt={article.publishedAt}
                    />
                    <h3 className="text-lg font-semibold text-white">
                      {article.title}
                    </h3>
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
  )
}

export function NewsFeed({
  activeCategory,
  initialArticles,
}: {
  activeCategory: CategoryFilter
  initialArticles: NewsArticleDto[]
}) {
  return (
    <NewsFeedInner
      activeCategory={activeCategory}
      initialArticles={initialArticles}
    />
  )
}

function NewsArchiveInner({
  initialArticles,
}: {
  initialArticles: NewsArticleDto[]
}) {
  const articlesQuery = useQuery({
    queryKey: newsQueryKeys.articles,
    queryFn: fetchNewsArticlesQuery,
    initialData: initialArticles,
    staleTime: 60_000,
  })
  const archivedArticles = (articlesQuery.data ?? []).slice(12)

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
                  <NewsArticleMetaRow
                    category={article.category}
                    className="text-xs"
                    publishedAt={article.publishedAt}
                  />
                  <h3 className="text-lg font-semibold text-white">
                    {article.title}
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-white/60">
                    {article.excerpt}
                  </p>
                </div>

                <ArrowRight className="mt-1 size-5 shrink-0 text-white/45" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function NewsArchive({
  initialArticles,
}: {
  initialArticles: NewsArticleDto[]
}) {
  return <NewsArchiveInner initialArticles={initialArticles} />
}

function NewsArticleInner({
  initialArticle,
  slug,
}: {
  initialArticle: NewsArticleDto
  slug: string
}) {
  const articleQuery = useQuery({
    queryKey: newsQueryKeys.article(slug),
    queryFn: () => fetchNewsArticleQuery(slug),
    initialData: initialArticle,
    staleTime: 60_000,
  })

  if (articleQuery.error instanceof Error) {
    return <p className="text-sm text-rose-300">{articleQuery.error.message}</p>
  }

  const article = articleQuery.data
  if (!article) {
    return null
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Button
        variant="ghost"
        asChild
        className="w-fit text-white/70 hover:text-white"
      >
        <Link href="/news">
          <ArrowLeft className="size-4 shrink-0" />
          Back to news
        </Link>
      </Button>
      <div className="overflow-hidden rounded-3xl">
        <NewsImage
          alt={article.title}
          className="h-[22rem] w-full object-cover"
          src={article.coverImageUrl}
        />
      </div>

      <div className="flex w-full flex-col gap-3">
        <NewsArticleMetaRow
          category={article.category}
          publishedAt={article.publishedAt}
        />
        <h1 className="text-3xl leading-tight font-semibold text-white">
          {article.title}
        </h1>
        <Separator className="mt-3 bg-white/10" />
        <div className="mt-6 flex flex-col gap-2">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm, remarkBreaks, remarkMdx]}
            components={{
              a(props) {
                const { children, className, ...rest } = props
                return (
                  <a
                    {...rest}
                    className={`inline-flex items-center gap-1.5 text-white underline underline-offset-4 ${className ?? ""}`.trim()}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <span>{children}</span>
                    <ArrowUpRight className="size-3.5 shrink-0" />
                  </a>
                )
              },
              h1(props) {
                return (
                  <h1
                    className="mt-4 w-full text-2xl font-semibold text-white"
                    {...props}
                  />
                )
              },
              h2(props) {
                return (
                  <h2
                    className="mt-4 w-full text-xl font-semibold text-white"
                    {...props}
                  />
                )
              },
              h3(props) {
                return (
                  <h3
                    className="mt-3 w-full text-lg font-semibold text-white"
                    {...props}
                  />
                )
              },
              p(props) {
                return (
                  <p
                    className="w-full text-base leading-relaxed text-white/65"
                    {...props}
                  />
                )
              },
              ul(props) {
                return (
                  <ul
                    className="w-full list-disc space-y-1 pl-6 text-base leading-relaxed text-white/65"
                    {...props}
                  />
                )
              },
              ol(props) {
                return (
                  <ol
                    className="w-full list-decimal space-y-1 pl-6 text-base leading-relaxed text-white/65"
                    {...props}
                  />
                )
              },
              li(props) {
                return <li className="leading-relaxed" {...props} />
              },
              code({ className, ...props }) {
                return (
                  <code
                    className={`rounded bg-white/10 px-1.5 py-0.5 text-[0.9em] ${className ?? ""}`.trim()}
                    {...props}
                  />
                )
              },
              pre(props) {
                return (
                  <pre
                    className="w-full overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white"
                    {...props}
                  />
                )
              },
              img({ alt, src }) {
                return src ? (
                  <img
                    alt={alt ?? ""}
                    className="w-full rounded-2xl object-cover"
                    src={src}
                  />
                ) : null
              },
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

export function NewsArticlePage({
  initialArticle,
  slug,
}: {
  initialArticle: NewsArticleDto
  slug: string
}) {
  return <NewsArticleInner initialArticle={initialArticle} slug={slug} />
}
