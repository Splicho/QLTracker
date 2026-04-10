import { NextResponse } from "next/server";

import { handleRouteError, routeError } from "@/lib/server/errors";
import { getNewsArticleBySlug, toNewsArticleDto } from "@/lib/server/news";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const article = await getNewsArticleBySlug(slug);

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
