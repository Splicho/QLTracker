import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import {
  extractPickupSessionToken,
  getPickupSessionCookieDeleteOptions,
  invalidatePickupSession,
} from "@/lib/server/pickup-auth"
import { getNotificationEnv } from "@/lib/server/env"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const token = extractPickupSessionToken(request)
    if (token) {
      await invalidatePickupSession(token)
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(
      getNotificationEnv().PICKUP_AUTH_COOKIE_NAME,
      "",
      getPickupSessionCookieDeleteOptions()
    )

    return response
  } catch (error) {
    return handleRouteError(error, "Pickup logout failed.")
  }
}
