import { NextResponse } from "next/server";
import type { NewsArticleCategory } from "@prisma/client";
import { z } from "zod";

import { handleRouteError, routeError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import {
  createUniqueNewsSlug,
  deleteNewsArticle,
  extractNewsImageUrls,
  getNewsArticleById,
  toNewsArticleDto,
  updateNewsArticle,
} from "@/lib/server/news";
import { deleteNewsImagesFromR2 } from "@/lib/server/r2";

const paramsSchema = z.object({
  articleId: z.string().min(1),
});

const bodySchema = z.object({
  category: z.enum(["launcher", "pickup", "infrastructure", "community"]),
  content: z.string().trim().min(1).max(20000),
  coverImageUrl: z.string().trim().url().optional().nullable(),
  publishedAt: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(160),
});

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    await requirePickupAdminSession(request);
    const { articleId } = paramsSchema.parse(await context.params);
    const article = await getNewsArticleById(articleId);

    if (!article) {
      routeError(404, "News article not found.");
    }

    return NextResponse.json({
      article: toNewsArticleDto(article),
    });
  } catch (error) {
    return handleRouteError(error, "News article could not be loaded.");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    await requirePickupAdminSession(request);
    const { articleId } = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    const existing = await getNewsArticleById(articleId);

    if (!existing) {
      routeError(404, "News article not found.");
    }

    const slug =
      body.title.trim() === existing.title
        ? existing.slug
        : await createUniqueNewsSlug(body.title, articleId);

    if (!slug) {
      routeError(400, "Article slug could not be generated.");
    }

    const article = await updateNewsArticle(articleId, {
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
    return handleRouteError(error, "News article could not be updated.");
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ articleId: string }> },
) {
  try {
    await requirePickupAdminSession(request);
    const { articleId } = paramsSchema.parse(await context.params);
    const article = await getNewsArticleById(articleId);

    if (!article) {
      routeError(404, "News article not found.");
    }

    await deleteNewsImagesFromR2(
      extractNewsImageUrls({
        content: article.content,
        coverImageUrl: article.coverImageUrl,
      }),
    );
    await deleteNewsArticle(articleId);

    return NextResponse.json({
      deletedArticleId: articleId,
    });
  } catch (error) {
    return handleRouteError(error, "News article could not be deleted.");
  }
}
