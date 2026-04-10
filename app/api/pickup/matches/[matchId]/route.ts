import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { getPickupMatchDetail } from "@/lib/server/pickup";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> },
) {
  try {
    const { matchId } = await context.params;

    return NextResponse.json({
      match: await getPickupMatchDetail(matchId),
    });
  } catch (error) {
    return handleRouteError(error, "Pickup match could not be loaded.");
  }
}
