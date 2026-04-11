import type { MetadataRoute } from "next"

import {
  listSitemapNewsArticles,
  listSitemapPickupMatches,
  listSitemapPickupPlayers,
} from "@/lib/server/public-seo"
import { getSiteUrl } from "@/lib/seo"

export const dynamic = "force-dynamic"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl().replace(/\/$/, "")
  const [articles, matches, players] = await Promise.all([
    listSitemapNewsArticles(),
    listSitemapPickupMatches(),
    listSitemapPickupPlayers(),
  ])

  const staticEntries: MetadataRoute.Sitemap = [
    {
      changeFrequency: "hourly",
      lastModified: new Date(),
      priority: 1,
      url: `${siteUrl}/servers`,
    },
    {
      changeFrequency: "hourly",
      lastModified: new Date(),
      priority: 0.9,
      url: `${siteUrl}/pickup`,
    },
    {
      changeFrequency: "hourly",
      lastModified: new Date(),
      priority: 0.8,
      url: `${siteUrl}/leaderboards`,
    },
    {
      changeFrequency: "daily",
      lastModified: articles[0]?.updatedAt ?? new Date(),
      priority: 0.8,
      url: `${siteUrl}/news`,
    },
    {
      changeFrequency: "weekly",
      lastModified: articles[0]?.updatedAt ?? new Date(),
      priority: 0.6,
      url: `${siteUrl}/news/archive`,
    },
  ]

  return [
    ...staticEntries,
    ...articles.map((article) => ({
      changeFrequency: "weekly" as const,
      lastModified: article.updatedAt,
      priority: 0.7,
      url: `${siteUrl}/news/${article.slug}`,
    })),
    ...players.map((player) => ({
      changeFrequency: "daily" as const,
      lastModified: player.updatedAt,
      priority: 0.7,
      url: `${siteUrl}/players/${player.steamId}`,
    })),
    ...matches.map((match) => ({
      changeFrequency: "weekly" as const,
      lastModified: match.updatedAt,
      priority: 0.5,
      url: `${siteUrl}/matches/${match.id}`,
    })),
  ]
}
