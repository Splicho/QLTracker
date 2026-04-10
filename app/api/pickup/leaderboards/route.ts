import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { getPickupLeaderboards } from "@/lib/server/pickup";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getPickupLeaderboards());
  } catch (error) {
    return handleRouteError(error, "Pickup leaderboards could not be loaded.");
  }
}
