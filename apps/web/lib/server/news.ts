import type { NewsArticle, NewsArticleCategory } from "@prisma/client"

import { getPrisma } from "@/lib/server/prisma"

export type NewsArticleDto = {
  category: NewsArticleCategory
  content: string
  coverImageUrl: string | null
  excerpt: string
  id: string
  publishedAt: string
  slug: string
  title: string
}

const markdownImagePattern = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const htmlImagePattern = /<img[^>]*src=(["'])(.*?)\1/gi
const htmlTagPattern = /<\/?[^>]+>/g
const htmlBreakPattern = /<br\s*\/?>/gi
const htmlEntityPattern =
  /&(nbsp|amp|quot|apos|lt|gt|#39|#x27|#x2F|#xA|#10|ZeroWidthSpace);/gi

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function decodeExcerptEntity(entity: string) {
  switch (entity.toLowerCase()) {
    case "nbsp":
      return " "
    case "amp":
      return "&"
    case "quot":
      return '"'
    case "apos":
    case "#39":
    case "#x27":
      return "'"
    case "lt":
      return "<"
    case "gt":
      return ">"
    case "#x2f":
      return "/"
    case "#xa":
    case "#10":
    case "zerowidthspace":
      return " "
    default:
      return " "
  }
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(htmlImagePattern, " ")
    .replace(htmlBreakPattern, " ")
    .replace(htmlTagPattern, " ")
    .replace(
      htmlEntityPattern,
      (_match, entity: string) => decodeExcerptEntity(entity)
    )
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_>#~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeNewsSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

export function deriveNewsExcerpt(content: string, maxLength = 220) {
  const plainText = stripMarkdown(content)
  if (!plainText) {
    return "Read the full article for the latest QLTracker update."
  }

  if (plainText.length <= maxLength) {
    return plainText
  }

  const truncated = plainText.slice(0, maxLength)
  const lastWhitespaceIndex = truncated.lastIndexOf(" ")
  const safeSlice =
    lastWhitespaceIndex > 120
      ? truncated.slice(0, lastWhitespaceIndex)
      : truncated

  return `${safeSlice.trim()}...`
}

export function extractNewsImageUrls(article: {
  content: string
  coverImageUrl?: string | null
}) {
  const imageUrls = new Set<string>()

  if (article.coverImageUrl) {
    imageUrls.add(article.coverImageUrl)
  }

  for (const match of article.content.matchAll(markdownImagePattern)) {
    const imageUrl = match[1]?.trim()
    if (imageUrl) {
      imageUrls.add(imageUrl)
    }
  }

  for (const match of article.content.matchAll(htmlImagePattern)) {
    const imageUrl = match[2]?.trim()
    if (imageUrl) {
      imageUrls.add(imageUrl)
    }
  }

  return Array.from(imageUrls)
}

export async function createUniqueNewsSlug(title: string, excludeId?: string) {
  const baseSlug = normalizeNewsSlug(title)
  if (!baseSlug) {
    return ""
  }

  const prisma = getPrisma()

  const existing = await prisma.newsArticle.findMany({
    where: {
      ...(excludeId
        ? {
            id: {
              not: excludeId,
            },
          }
        : {}),
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  })

  if (!existing.some((article) => article.slug === baseSlug)) {
    return baseSlug
  }

  let suffix = 2
  while (existing.some((article) => article.slug === `${baseSlug}-${suffix}`)) {
    suffix += 1
  }

  return `${baseSlug}-${suffix}`
}

export function toNewsArticleDto(article: NewsArticle): NewsArticleDto {
  return {
    category: article.category,
    content: article.content,
    coverImageUrl: article.coverImageUrl ?? null,
    excerpt: article.excerpt,
    id: article.id,
    publishedAt: article.publishedAt.toISOString(),
    slug: article.slug,
    title: article.title,
  }
}

export async function listNewsArticles() {
  return getPrisma().newsArticle.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  })
}

export async function listNewsArticleDtos() {
  const articles = await listNewsArticles()
  return articles.map(toNewsArticleDto)
}

export async function getNewsArticleBySlug(slug: string) {
  return getPrisma().newsArticle.findUnique({
    where: {
      slug,
    },
  })
}

export async function getNewsArticleById(id: string) {
  return getPrisma().newsArticle.findUnique({
    where: {
      id,
    },
  })
}

export async function createNewsArticle(data: {
  category: NewsArticleCategory
  content: string
  coverImageUrl?: string | null
  publishedAt?: Date
  slug: string
  title: string
}) {
  return getPrisma().newsArticle.create({
    data: {
      category: data.category,
      content: data.content.trim(),
      coverImageUrl: normalizeOptional(data.coverImageUrl),
      excerpt: deriveNewsExcerpt(data.content),
      publishedAt: data.publishedAt ?? new Date(),
      slug: data.slug,
      title: data.title.trim(),
    },
  })
}

export async function updateNewsArticle(
  id: string,
  data: {
    category: NewsArticleCategory
    content: string
    coverImageUrl?: string | null
    publishedAt?: Date
    slug: string
    title: string
  }
) {
  return getPrisma().newsArticle.update({
    where: {
      id,
    },
    data: {
      category: data.category,
      content: data.content.trim(),
      coverImageUrl: normalizeOptional(data.coverImageUrl),
      excerpt: deriveNewsExcerpt(data.content),
      publishedAt: data.publishedAt ?? new Date(),
      slug: data.slug,
      title: data.title.trim(),
    },
  })
}

export async function deleteNewsArticle(id: string) {
  return getPrisma().newsArticle.delete({
    where: {
      id,
    },
  })
}
