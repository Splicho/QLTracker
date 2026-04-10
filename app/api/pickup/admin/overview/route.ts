import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import {
  getPickupAdminOverview,
} from "@/lib/server/pickup";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requirePickupAdminSession(request);
    return NextResponse.json(await getPickupAdminOverview(session.player));
  } catch (error) {
    return handleRouteError(error, "Pickup admin overview could not be loaded.");
  }
}
