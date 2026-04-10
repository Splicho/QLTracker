import type { Metadata } from "next"

export const siteConfig = {
  name: "QLTracker",
  shortName: "QLTracker",
  url: "https://qltracker.com",
  creator: "isevendeuce",
  description:
    "Realtime Quake Live server browser with pickup queues, player profiles, leaderboards, match history, and community news.",
  keywords: [
    "QLTracker",
    "Quake Live",
    "Quake Live server browser",
    "Quake Live pickup",
    "Quake Live profiles",
    "Quake Live leaderboards",
    "Quake Live match history",
    "Quake Live news",
    "qlstats",
  ],
  ogImage: {
    alt: "QLTracker preview",
    height: 630,
    url: "/images/og-image.jpg",
    width: 1200,
  },
} as const

export function getSiteUrl(): string {
  const envUrl =
    process.env.PUBLIC_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()

  if (!envUrl) {
    return siteConfig.url
  }

  if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) {
    return envUrl
  }

  return `https://${envUrl}`
}

export function getMetadataBase() {
  return new URL(getSiteUrl())
}

export function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl
  }

  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`
  return new URL(normalizedPath, getSiteUrl()).toString()
}

export function createSiteMetadata(): Metadata {
  return {
    metadataBase: getMetadataBase(),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    description: siteConfig.description,
    applicationName: siteConfig.name,
    keywords: [...siteConfig.keywords],
    authors: [
      {
        name: siteConfig.creator,
      },
    ],
    creator: siteConfig.creator,
    publisher: siteConfig.name,
    openGraph: {
      description: siteConfig.description,
      images: [siteConfig.ogImage],
      locale: "en_US",
      siteName: siteConfig.name,
      title: siteConfig.name,
      type: "website",
      url: "/servers",
    },
    twitter: {
      card: "summary_large_image",
      description: siteConfig.description,
      images: [siteConfig.ogImage.url],
      title: siteConfig.name,
    },
    icons: {
      apple: "/images/icons/apple-touch-icon.png",
      icon: [
        {
          rel: "icon",
          type: "image/png",
          url: "/images/icons/favicon-96x96.png",
        },
      ],
      shortcut: "/images/icons/favicon-96x96.png",
    },
  }
}

export function createPageMetadata({
  description,
  path,
  title,
}: {
  description?: string
  path: string
  title?: string
}): Metadata {
  const resolvedDescription = description ?? siteConfig.description
  const resolvedTitle = title ?? siteConfig.name

  return {
    title,
    description: resolvedDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      description: resolvedDescription,
      images: [siteConfig.ogImage],
      locale: "en_US",
      siteName: siteConfig.name,
      title: resolvedTitle,
      type: "website",
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      description: resolvedDescription,
      images: [siteConfig.ogImage.url],
      title: resolvedTitle,
    },
  }
}

export function createArticleMetadata({
  description,
  imageUrl,
  path,
  publishedAt,
  title,
}: {
  description: string
  imageUrl?: string
  path: string
  publishedAt: string
  title: string
}): Metadata {
  const resolvedImageUrl = resolveAbsoluteUrl(
    imageUrl ?? siteConfig.ogImage.url
  )

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: "en_US",
      type: "article",
      publishedTime: publishedAt,
      authors: [siteConfig.creator],
      images: [
        {
          alt: title,
          url: resolvedImageUrl,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImageUrl],
    },
  }
}

export function createPlayerMetadata({
  description,
  path,
  title,
}: {
  description: string
  path: string
  title: string
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: "en_US",
      type: "profile",
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage.url],
    },
  }
}

export function createMatchMetadata({
  description,
  path,
  title,
}: {
  description: string
  path: string
  title: string
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      locale: "en_US",
      type: "website",
      images: [siteConfig.ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [siteConfig.ogImage.url],
    },
  }
}
