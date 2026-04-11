import type { Metadata } from "next"

import { NewsFeed } from "@/components/news-public"
import { listNewsArticleDtos } from "@/lib/server/news"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "News",
  path: "/news",
  description:
    "Read the latest QLTracker pickup, infrastructure, and community updates.",
})

function toCategoryFilter(value: string | undefined) {
  switch (value) {
    case "community":
      return "Community"
    case "infrastructure":
      return "Infrastructure"
    case "launcher":
      return "Launcher"
    case "pickup":
      return "Pickup"
    default:
      return "All"
  }
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const articles = await listNewsArticleDtos()

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4">
      <NewsFeed
        activeCategory={toCategoryFilter(params.category)}
        initialArticles={articles}
      />
    </section>
  )
}
