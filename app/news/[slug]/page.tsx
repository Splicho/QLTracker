import type { Metadata } from "next";
import Script from "next/script";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { NewsArticlePage } from "@/components/news-public";
import { newsQueryKeys } from "@/lib/news-query";
import { toNewsArticleDto } from "@/lib/server/news";
import { getPublicNewsArticle } from "@/lib/server/public-seo";
import { createArticleMetadata, createPageMetadata, resolveAbsoluteUrl, siteConfig } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublicNewsArticle(slug);

  if (!article) {
    return createPageMetadata({
      title: "News",
      path: `/news/${slug}`,
      description: "QLTracker news article.",
    });
  }

  return createArticleMetadata({
    title: article.title,
    path: `/news/${article.slug}`,
    description: article.excerpt,
    imageUrl: `/news/${article.slug}/opengraph-image`,
    publishedAt: article.publishedAt.toISOString(),
  });
}

export default async function NewsSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublicNewsArticle(slug);

  if (!article) {
    notFound();
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(newsQueryKeys.article(slug), toNewsArticleDto(article));
  const articleUrl = resolveAbsoluteUrl(`/news/${article.slug}`);
  const imageUrl = resolveAbsoluteUrl(article.coverImageUrl ?? siteConfig.ogImage.url);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt.toISOString(),
    dateModified: article.publishedAt.toISOString(),
    image: [imageUrl],
    author: [
      {
        "@type": "Person",
        name: siteConfig.creator,
      },
    ],
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: resolveAbsoluteUrl("/images/logo.png"),
      },
    },
    mainEntityOfPage: articleUrl,
    url: articleUrl,
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-4">
      <Script
        id={`news-article-jsonld-${article.slug}`}
        type="application/ld+json"
      >
        {JSON.stringify(articleJsonLd)}
      </Script>
      <NewsArticlePage slug={slug} state={dehydrate(queryClient)} />
    </section>
  );
}
