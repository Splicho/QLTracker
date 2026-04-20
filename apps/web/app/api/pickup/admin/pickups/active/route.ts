import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { getPickupAdminActivePickups } from "@/lib/server/pickup"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requirePickupAdminSession(request)
    const matches = await getPickupAdminActivePickups()

    return NextResponse.json({ ok: true, matches })
  } catch (error) {
    return handleRouteError(error, "Active pickups could not be loaded.")
  }
}
