import type { MetadataRoute } from "next"

import { getSiteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()

  return {
    host: siteUrl,
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/servers",
          "/pickup",
          "/leaderboards",
          "/news",
          "/players",
          "/matches",
        ],
        disallow: [
          "/admin",
          "/pickup/admin",
          "/api",
          "/auth",
          "/favorites",
          "/watchlist",
          "/settings",
        ],
      },
    ],
    sitemap: `${siteUrl.replace(/\/$/, "")}/sitemap.xml`,
  }
}
