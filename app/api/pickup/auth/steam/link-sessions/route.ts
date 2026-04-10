import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import {
  createPickupOauthState,
  getPickupLinkSessionExpiry,
} from "@/lib/server/pickup-auth"
import {
  buildPickupSteamAuthorizeUrl,
  ensurePickupBootstrapData,
} from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

export const runtime = "nodejs"

function getLauncherRedirectPath(request: Request) {
  const referer = request.headers.get("referer")

  if (!referer) {
    return "/pickup"
  }

  try {
    const refererUrl = new URL(referer)

    return `${refererUrl.pathname}${refererUrl.search}`
  } catch {
    return "/pickup"
  }
}

export async function POST(request: Request) {
  try {
    await ensurePickupBootstrapData()

    const prisma = getPrisma()
    const oauthState = createPickupOauthState()
    const linkSession = await prisma.pickupLinkSession.create({
      data: {
        expiresAt: getPickupLinkSessionExpiry(),
        flow: "launcher",
        oauthState,
        redirectPath: getLauncherRedirectPath(request),
      },
    })

    return NextResponse.json({
      authorizeUrl: buildPickupSteamAuthorizeUrl(oauthState),
      expiresAt: linkSession.expiresAt.toISOString(),
      id: linkSession.id,
    })
  } catch (error) {
    return handleRouteError(
      error,
      "Pickup sign-in is not configured correctly."
    )
  }
}
