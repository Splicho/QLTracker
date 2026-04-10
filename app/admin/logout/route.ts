import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getNotificationEnv } from "@/lib/server/env"
import {
  getPickupSessionCookieDeleteOptions,
  invalidatePickupSession,
} from "@/lib/server/pickup-auth"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const cookieStore = await cookies()
  const cookieName = getNotificationEnv().PICKUP_AUTH_COOKIE_NAME
  const token = cookieStore.get(cookieName)?.value

  if (token) {
    await invalidatePickupSession(token)
  }

  const response = NextResponse.redirect(
    new URL("/admin/login", getNotificationEnv().PUBLIC_BASE_URL)
  )
  response.cookies.set(cookieName, "", getPickupSessionCookieDeleteOptions(request))

  return response
}
