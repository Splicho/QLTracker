"use client"

import Link from "next/link"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
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
  "Matchmaking",
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
      return "Matchmaking"
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
      <span className="font-semibold text-muted-foreground uppercase">
        {toLabel(category)}
      </span>
      <span
        aria-hidden
        className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50"
      />
      <span className="font-normal text-muted-foreground normal-case">
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
        className={`flex items-center justify-center bg-muted/40 text-sm text-muted-foreground ${className ?? ""}`.trim()}
      >
        No cover image
      </div>
    )
  }

  return <img alt={alt} className={className} src={src} />
}

function normalizeArticleImageWidth(width?: number | string) {
  if (typeof width === "number") {
    return `${width}px`
  }

  if (typeof width !== "string") {
    return undefined
  }

  const trimmedWidth = width.trim()
  return trimmedWidth.length > 0 ? trimmedWidth : undefined
}

function countMarkdownTablePipes(line: string) {
  return line.match(/\|/g)?.length ?? 0
}

function isMarkdownTableSeparator(line: string) {
  return /^\|\s*:?-{3,}[\s|:-]*\|?\s*$/.test(line)
}

function parseMarkdownTableRow(line: string) {
  const trimmedLine = line.trim()

  if (!trimmedLine.startsWith("|")) {
    return null
  }

  const normalizedLine = trimmedLine.endsWith("|")
    ? trimmedLine.slice(1, -1)
    : trimmedLine.slice(1)

  return normalizedLine.split("|").map((cell) => cell.trim())
}

function stringifyMarkdownTableRow(cells: string[]) {
  return `| ${cells.join(" | ")} |`
}

function isBrokenImageOnlyCell(cell: string) {
  const normalizedCell = cell
    .replaceAll("&#xA;", "")
    .replaceAll("<br/>", "")
    .replaceAll("<br />", "")
    .trim()

  return normalizedCell.startsWith("<img")
}

function normalizeMergedImageCell(cell: string) {
  return cell
    .replaceAll("&#xA;", " ")
    .replace(/(?:<br\s*\/?>\s*)+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeMarkdownTableRows(rows: string[]) {
  const normalizedRows: string[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const currentCells = parseMarkdownTableRow(rows[index]!)
    const nextCells = parseMarkdownTableRow(rows[index + 1] ?? "")

    if (
      currentCells &&
      nextCells &&
      currentCells.length === nextCells.length &&
      currentCells[0] &&
      currentCells.slice(1).every((cell) => cell.length === 0) &&
      isBrokenImageOnlyCell(nextCells[0] ?? "") &&
      nextCells.slice(1).some((cell) => cell.length > 0)
    ) {
      const normalizedImageCell = normalizeMergedImageCell(nextCells[0] ?? "")
      const mergedCells = currentCells.map((cell, cellIndex) => {
        if (cellIndex === 0) {
          return `${cell}${normalizedImageCell ? ` ${normalizedImageCell}` : ""}`.trim()
        }

        return cell || nextCells[cellIndex] || ""
      })

      normalizedRows.push(stringifyMarkdownTableRow(mergedCells))
      index += 1
      continue
    }

    normalizedRows.push(rows[index]!)
  }

  return normalizedRows
}

function normalizeArticleMarkdown(content: string) {
  const lines = content.split(/\r?\n/)
  const normalizedLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const trimmedLine = line.trim()
    const nextTrimmedLine = lines[index + 1]?.trim()

    if (
      trimmedLine.startsWith("|") &&
      nextTrimmedLine &&
      isMarkdownTableSeparator(nextTrimmedLine)
    ) {
      const expectedPipeCount = countMarkdownTablePipes(trimmedLine)

      normalizedLines.push(trimmedLine)
      index += 1
      normalizedLines.push(lines[index]!.trim())
      const tableRows: string[] = []

      while (index + 1 < lines.length) {
        const nextLine = lines[index + 1]!
        const nextTableLine = nextLine.trim()

        if (!nextTableLine || !nextTableLine.startsWith("|")) {
          break
        }

        index += 1
        let row = lines[index]!.trim()

        while (
          countMarkdownTablePipes(row) < expectedPipeCount &&
          index + 1 < lines.length
        ) {
          const continuationLine = lines[index + 1]!.trim()

          if (!continuationLine) {
            break
          }

          index += 1
          row = `${row} ${continuationLine}`
        }

        tableRows.push(row)
      }

      normalizedLines.push(...normalizeMarkdownTableRows(tableRows))

      continue
    }

    normalizedLines.push(line)
  }

  return normalizedLines.join("\n")
}

function withoutNodeProp<T extends { node?: unknown }>(
  props: T
): Omit<T, "node"> {
  const { node, ...rest } = props
  void node
  return rest
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
            : `/news?category=${category === "Matchmaking" ? "pickup" : category.toLowerCase()}`
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
            className="h-14 rounded-none px-3 text-sm font-medium text-muted-foreground after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px] hover:text-foreground data-[state=active]:text-foreground"
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
      <h1 className="text-xl font-semibold text-foreground">QLTracker News</h1>

      {articlesQuery.error instanceof Error ? (
        <p className="text-sm text-rose-300">{articlesQuery.error.message}</p>
      ) : null}

      {!articlesQuery.isLoading && visibleArticles.length === 0 ? (
        <div className="pt-2">
          <h2 className="text-xl font-semibold text-foreground">No news yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
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
              <div className="pointer-events-none absolute inset-0 scale-95 rounded-[1.25rem] bg-muted opacity-0 transition duration-300 ease-out group-hover:scale-100 group-hover:opacity-100" />
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
              <h2 className="relative text-2xl leading-tight font-semibold text-foreground">
                {article.title}
              </h2>
              <p className="relative text-sm leading-6 text-muted-foreground">
                {article.excerpt}
              </p>
              <Link
                className="relative mt-4 inline-flex w-fit items-center gap-2 text-sm font-semibold text-foreground"
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
          <div className="h-px bg-border" />
          <div className="flex flex-col">
            {listArticles.map((article, index) => (
              <div key={article.id}>
                {index > 0 ? <div className="h-px bg-border" /> : null}
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
                    <h3 className="text-lg font-semibold text-foreground">
                      {article.title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                      {article.excerpt}
                    </p>
                  </div>

                  <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {archivedArticles.length > 0 ? (
        <>
          <div className="h-px bg-border" />
          <div className="pt-3">
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/50"
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
        <h1 className="text-xl font-semibold text-foreground">
          Article Archive
        </h1>
        <Link
          className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
          href="/news"
        >
          Back to latest news
        </Link>
      </div>

      {articlesQuery.error instanceof Error ? (
        <p className="text-sm text-rose-300">{articlesQuery.error.message}</p>
      ) : null}

      {archivedArticles.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No archived articles yet.
        </p>
      ) : (
        <div className="flex flex-col">
          {archivedArticles.map((article, index) => (
            <div key={article.id}>
              {index > 0 ? <div className="h-px bg-border" /> : null}
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
                  <h3 className="text-lg font-semibold text-foreground">
                    {article.title}
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                    {article.excerpt}
                  </p>
                </div>

                <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
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

  const renderedArticleContent = normalizeArticleMarkdown(article.content)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <Button
        variant="ghost"
        asChild
        className="w-fit text-muted-foreground hover:text-foreground"
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
        <h1 className="text-3xl leading-tight font-semibold text-foreground">
          {article.title}
        </h1>
        <Separator className="mt-3 bg-border" />
        <div className="mt-6 flex flex-col gap-2">
          <ReactMarkdown
            rehypePlugins={[rehypeRaw]}
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a(props) {
                const { children, className, ...rest } = withoutNodeProp(props)
                return (
                  <a
                    {...rest}
                    className={`inline-flex items-center gap-1.5 text-foreground underline underline-offset-4 ${className ?? ""}`.trim()}
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
                    className="mt-4 w-full text-2xl font-semibold text-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              h2(props) {
                return (
                  <h2
                    className="mt-4 w-full text-xl font-semibold text-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              h3(props) {
                return (
                  <h3
                    className="mt-3 w-full text-lg font-semibold text-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              p(props) {
                return (
                  <p
                    className="w-full text-base leading-relaxed text-muted-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              ul(props) {
                return (
                  <ul
                    className="w-full list-disc space-y-1 pl-6 text-base leading-relaxed text-muted-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              ol(props) {
                return (
                  <ol
                    className="w-full list-decimal space-y-1 pl-6 text-base leading-relaxed text-muted-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              li(props) {
                return (
                  <li
                    className="leading-relaxed"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              code(props) {
                const { className, ...rest } = withoutNodeProp(props)
                return (
                  <code
                    className={`rounded bg-muted px-1.5 py-0.5 text-[0.9em] text-foreground ${className ?? ""}`.trim()}
                    {...rest}
                  />
                )
              },
              pre(props) {
                return (
                  <pre
                    className="w-full overflow-x-auto rounded-xl border border-border bg-muted/40 p-4 text-sm text-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              img(props) {
                const { alt, src, width } = withoutNodeProp(props)
                const imageWidth = normalizeArticleImageWidth(width)
                const parsedWidth = imageWidth
                  ? Number.parseFloat(imageWidth)
                  : Number.NaN
                const isInlineSizedImage =
                  Number.isFinite(parsedWidth) && parsedWidth <= 128

                return src ? (
                  <img
                    alt={alt ?? ""}
                    className={cn(
                      "max-w-full rounded-2xl object-cover",
                      isInlineSizedImage
                        ? "inline-block align-middle"
                        : "mx-auto block"
                    )}
                    src={src}
                    style={{ width: imageWidth ?? "100%" }}
                  />
                ) : null
              },
              table(props) {
                return (
                  <div className="my-5 overflow-x-auto rounded-2xl border border-border bg-muted/20">
                    <table
                      className="min-w-full border-collapse text-sm text-muted-foreground"
                      {...withoutNodeProp(props)}
                    />
                  </div>
                )
              },
              thead(props) {
                return (
                  <thead
                    className="bg-white/[0.04]"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              tbody(props) {
                return <tbody {...withoutNodeProp(props)} />
              },
              tr(props) {
                return (
                  <tr
                    className="border-b border-border last:border-b-0"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              th(props) {
                return (
                  <th
                    className="border-r border-border px-4 py-3 text-left font-semibold text-foreground last:border-r-0 [&_p]:mb-0 [&_span]:text-foreground"
                    {...withoutNodeProp(props)}
                  />
                )
              },
              td(props) {
                return (
                  <td
                    className="border-r border-border px-4 py-3 align-top text-muted-foreground last:border-r-0 [&_img]:my-0 [&_img]:rounded-xl [&_p]:mb-0 [&_span]:text-inherit"
                    {...withoutNodeProp(props)}
                  />
                )
              },
            }}
          >
            {renderedArticleContent}
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
