export const READ_NEWS_SLUGS_COOKIE_NAME = "qltracker-read-news-slugs"

const READ_NEWS_SLUGS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const MAX_READ_NEWS_SLUGS = 50

function normalizeReadNewsSlugs(slugs: string[]) {
  return Array.from(
    new Set(slugs.map((slug) => slug.trim()).filter(Boolean))
  ).slice(0, MAX_READ_NEWS_SLUGS)
}

export function getReadNewsSlugsCookieMaxAge() {
  return READ_NEWS_SLUGS_COOKIE_MAX_AGE
}

export function parseReadNewsSlugsCookie(
  value: string | null | undefined
): string[] {
  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (Array.isArray(parsed)) {
      return normalizeReadNewsSlugs(
        parsed.filter((entry): entry is string => typeof entry === "string")
      )
    }
  } catch {
    // Support older single-slug cookie values during migration.
  }

  return normalizeReadNewsSlugs([value])
}

export function serializeReadNewsSlugsCookie(slugs: string[]) {
  return JSON.stringify(normalizeReadNewsSlugs(slugs))
}
