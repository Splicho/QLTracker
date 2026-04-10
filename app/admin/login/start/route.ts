import { NextResponse } from "next/server"

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

  return NextResponse.redirect(buildPickupSteamAuthorizeUrl(oauthState))
}
