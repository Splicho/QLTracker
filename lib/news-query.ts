import type { NewsArticleDto } from "@/lib/server/news";

export const newsQueryKeys = {
  article: (slug: string) => ["news", "article", slug] as const,
  articles: ["news", "articles"] as const,
};

async function requestNewsApi<T>(path: string) {
  const response = await fetch(path, {
    credentials: "same-origin",
  });

  if (!response.ok) {
    let message = `News API returned HTTP ${response.status}.`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Ignore invalid payloads.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export function fetchNewsArticlesQuery() {
  return requestNewsApi<{ articles: NewsArticleDto[] }>("/api/news").then(
    (payload) => payload.articles,
  );
}

export function fetchNewsArticleQuery(slug: string) {
  return requestNewsApi<{ article: NewsArticleDto }>(
    `/api/news/${encodeURIComponent(slug)}`,
  ).then((payload) => payload.article);
}
