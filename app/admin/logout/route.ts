import { NextResponse } from "next/server"
import { cookies } from "next/headers"

import { getNotificationEnv } from "@/lib/server/env"
import { invalidatePickupSession } from "@/lib/server/pickup-auth"

export const runtime = "nodejs"

export async function GET() {
  const cookieStore = await cookies()
  const cookieName = getNotificationEnv().PICKUP_AUTH_COOKIE_NAME
  const token = cookieStore.get(cookieName)?.value

  if (token) {
    await invalidatePickupSession(token)
  }

  const response = NextResponse.redirect(
    new URL("/admin/login", getNotificationEnv().PUBLIC_BASE_URL)
  )
  response.cookies.set(cookieName, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  })

  return response
}
