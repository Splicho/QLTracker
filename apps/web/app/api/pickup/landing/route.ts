import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { getPickupLandingData } from "@/lib/server/pickup"

export const runtime = "nodejs"

export async function GET() {
  try {
    return NextResponse.json(await getPickupLandingData())
  } catch (error) {
    return handleRouteError(error, "Pickup landing data could not be loaded.")
  }
}
