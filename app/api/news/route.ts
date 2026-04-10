import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { listNewsArticleDtos } from "@/lib/server/news";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      articles: await listNewsArticleDtos(),
    });
  } catch (error) {
    return handleRouteError(error, "News articles could not be loaded.");
  }
}
