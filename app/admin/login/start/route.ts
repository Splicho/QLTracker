import { NextResponse } from "next/server"

import {
  createPickupOauthState,
  getPickupLinkSessionExpiry,
  logPickupAuthDebug,
} from "@/lib/server/pickup-auth"
import {
  buildPickupSteamAuthorizeUrl,
  ensurePickupBootstrapData,
} from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

export const runtime = "nodejs"

export async function GET() {
  await ensurePickupBootstrapData()

  const prisma = getPrisma()
  const oauthState = createPickupOauthState()
  await prisma.pickupLinkSession.create({
    data: {
      expiresAt: getPickupLinkSessionExpiry(),
      flow: "browser",
      oauthState,
      redirectPath: "/admin",
    },
  })

  const authorizeUrl = buildPickupSteamAuthorizeUrl(oauthState)
  logPickupAuthDebug("admin login start: redirecting to Steam", {
    authorizeHost: new URL(authorizeUrl).host,
  })

  return NextResponse.redirect(authorizeUrl)
}
