import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { getPickupPlayerProfile } from "@/lib/server/pickup";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ playerId: string }> },
) {
  try {
    const { playerId } = await context.params;

    return NextResponse.json({
      profile: await getPickupPlayerProfile(playerId),
    });
  } catch (error) {
    return handleRouteError(error, "Pickup player profile could not be loaded.");
  }
}
