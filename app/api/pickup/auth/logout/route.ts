import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import {
  extractPickupSessionToken,
  getPickupSessionCookieDeleteOptions,
  invalidatePickupSession,
  serializePickupSessionSetCookie,
  type PickupSessionCookieSetOpts,
} from "@/lib/server/pickup-auth"
import { getNotificationEnv } from "@/lib/server/env"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    const token = extractPickupSessionToken(request)
    if (token) {
      await invalidatePickupSession(token)
    }

    const cookieName = getNotificationEnv().PICKUP_AUTH_COOKIE_NAME
    const delOpts = getPickupSessionCookieDeleteOptions(request)
    return NextResponse.json(
      { ok: true },
      {
        headers: {
          "Set-Cookie": serializePickupSessionSetCookie(
            cookieName,
            "",
            delOpts as PickupSessionCookieSetOpts
          ),
        },
      }
    )
  } catch (error) {
    return handleRouteError(error, "Pickup logout failed.")
  }
}
