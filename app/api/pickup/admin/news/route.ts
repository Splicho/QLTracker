import { NextResponse } from "next/server";
import type { NewsArticleCategory } from "@prisma/client";
import { z } from "zod";

import { handleRouteError, routeError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import {
  createUniqueNewsSlug,
  createNewsArticle,
  listNewsArticleDtos,
  toNewsArticleDto,
} from "@/lib/server/news";

const bodySchema = z.object({
  category: z.enum(["launcher", "pickup", "infrastructure", "community"]),
  content: z.string().trim().min(1).max(20000),
  coverImageUrl: z.string().trim().url().optional().nullable(),
  publishedAt: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(160),
});

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePickupAdminSession(request);

    return NextResponse.json({
      articles: await listNewsArticleDtos(),
    });
  } catch (error) {
    return handleRouteError(error, "News articles could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request);
    const body = bodySchema.parse(await request.json());
    const slug = await createUniqueNewsSlug(body.title);

    if (!slug) {
      routeError(400, "Article slug could not be generated.");
    }

    const article = await createNewsArticle({
      category: body.category as NewsArticleCategory,
      content: body.content,
      coverImageUrl: body.coverImageUrl ?? null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : undefined,
      slug,
      title: body.title,
    });

    return NextResponse.json({
      article: toNewsArticleDto(article),
    });
  } catch (error) {
    return handleRouteError(error, "News article could not be created.");
  }
}
