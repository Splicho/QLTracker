import type { Metadata } from "next"

import { NewsArchive } from "@/components/news-public"
import { listNewsArticleDtos } from "@/lib/server/news"
import { createPageMetadata } from "@/lib/seo"

export const dynamic = "force-dynamic"

export const metadata: Metadata = createPageMetadata({
  title: "News Archive",
  path: "/news/archive",
  description:
    "Browse older QLTracker news posts and archived update coverage.",
})

export default async function NewsArchivePage() {
  const articles = await listNewsArticleDtos()

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4">
      <NewsArchive initialArticles={articles} />
    </section>
  )
}
