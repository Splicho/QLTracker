import { NextResponse } from "next/server"

import {
  PICKUP_GUEST_STORAGE_KEY,
  PICKUP_SESSION_STORAGE_KEY,
} from "@/lib/pickup-auth-storage"
import {
  createPickupAppSession,
  getPickupSessionCookieSetOptions,
  logPickupAuthDebug,
} from "@/lib/server/pickup-auth"
import { getNotificationEnv } from "@/lib/server/env"
import {
  buildPickupAuthResultHtml,
  upsertPickupPlayer,
  validatePickupSteamCallback,
} from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

export const runtime = "nodejs"

function logCallbackIngress(request: Request) {
  const u = new URL(request.url)
  logPickupAuthDebug("steam callback: ingress", {
    urlHost: u.host,
    pathname: u.pathname,
    hasPickupState: u.searchParams.has("pickup_state"),
    openidMode: u.searchParams.get("openid.mode"),
    xForwardedHost: request.headers.get("x-forwarded-host"),
    xForwardedProto: request.headers.get("x-forwarded-proto"),
    xForwardedSsl: request.headers.get("x-forwarded-ssl"),
  })
}

function redirectToLauncherPath(pathname: string | null | undefined) {
  const publicBaseUrl = getNotificationEnv().PUBLIC_BASE_URL.replace(/\/$/, "")
  return NextResponse.redirect(new URL(pathname || "/pickup", publicBaseUrl))
}

function buildLauncherRedirectHtml(
  targetPath: string | null | undefined,
  sessionToken: string
) {
  const publicBaseUrl = getNotificationEnv().PUBLIC_BASE_URL.replace(/\/$/, "")
  const targetUrl = new URL(targetPath || "/pickup", publicBaseUrl).toString()

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Redirecting...</title>
  </head>
  <body>
    <script>
      try {
        window.localStorage.setItem(${JSON.stringify(PICKUP_SESSION_STORAGE_KEY)}, ${JSON.stringify(sessionToken)});
        window.localStorage.setItem(${JSON.stringify(PICKUP_GUEST_STORAGE_KEY)}, "false");
      } catch {}
      window.location.replace(${JSON.stringify(targetUrl)});
    </script>
  </body>
</html>`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  logCallbackIngress(request)

  const error =
    url.searchParams.get("openid.mode") === "cancel" ? "cancelled" : null
  const state = url.searchParams.get("pickup_state")
  const prisma = getPrisma()

  if (!state) {
    logPickupAuthDebug("steam callback: abort — missing pickup_state")
    return redirectToLauncherPath("/pickup")
  }

  const linkSession = await prisma.pickupLinkSession.findUnique({
    where: { oauthState: state },
  })

  if (!linkSession) {
    logPickupAuthDebug(
      "steam callback: abort — no PickupLinkSession for oauth state"
    )
    return redirectToLauncherPath("/pickup")
  }

  logPickupAuthDebug("steam callback: link session found", {
    flow: linkSession.flow,
    redirectPath: linkSession.redirectPath,
    status: linkSession.status,
    expiresAtMs: linkSession.expiresAt.getTime(),
  })

  if (linkSession.expiresAt.getTime() <= Date.now()) {
    await prisma.pickupLinkSession.update({
      where: { id: linkSession.id },
      data: {
        errorMessage: "The Steam sign-in session expired before completion.",
        status: "expired",
      },
    })

    if (linkSession.flow === "launcher") {
      return redirectToLauncherPath(linkSession.redirectPath)
    }

    logPickupAuthDebug("steam callback: link session expired (browser flow)")
    return new Response(
      buildPickupAuthResultHtml(
        false,
        "This QLTracker pickup login session expired. Start it again from the app."
      ),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 400,
      }
    )
  }

  if (error) {
    logPickupAuthDebug("steam callback: user cancelled or OpenID error mode")
    await prisma.pickupLinkSession.update({
      where: { id: linkSession.id },
      data: {
        errorMessage: "Steam authorization did not complete.",
        status: "error",
      },
    })

    if (linkSession.flow === "launcher") {
      return redirectToLauncherPath(linkSession.redirectPath)
    }

    return new Response(
      buildPickupAuthResultHtml(false, "Steam authorization did not complete."),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 400,
      }
    )
  }

  try {
    const steamId = await validatePickupSteamCallback(url)
    const player = await upsertPickupPlayer(steamId)
    const sessionToken = await createPickupAppSession(player.id)

    await prisma.pickupLinkSession.update({
      where: { id: linkSession.id },
      data: {
        appSessionToken: linkSession.flow === "launcher" ? sessionToken : null,
        completedAt: new Date(),
        errorMessage: null,
        playerId: player.id,
        status: "complete",
      },
    })

    if (linkSession.flow === "browser") {
      const publicBaseUrl = getNotificationEnv().PUBLIC_BASE_URL.replace(
        /\/$/,
        ""
      )
      const redirectTo = new URL(
        linkSession.redirectPath || "/admin",
        publicBaseUrl
      )
      const cookieOpts = getPickupSessionCookieSetOptions()
      logPickupAuthDebug("steam callback: success — setting session cookie", {
        PUBLIC_BASE_URL: publicBaseUrl,
        redirectTo: redirectTo.toString(),
        cookieName: getNotificationEnv().PICKUP_AUTH_COOKIE_NAME,
        cookieOptions: cookieOpts,
        sessionTokenLength: sessionToken.length,
        NODE_ENV: process.env.NODE_ENV,
      })
      const response = NextResponse.redirect(redirectTo)
      response.cookies.set(
        getNotificationEnv().PICKUP_AUTH_COOKIE_NAME,
        sessionToken,
        cookieOpts
      )
      return response
    }

    logPickupAuthDebug("steam callback: success — launcher flow (localStorage)")
    return new Response(
      buildLauncherRedirectHtml(linkSession.redirectPath, sessionToken),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Steam authorization failed."

    logPickupAuthDebug("steam callback: validation / upsert failed", {
      message,
    })

    await prisma.pickupLinkSession.update({
      where: { id: linkSession.id },
      data: {
        errorMessage: message,
        status: "error",
      },
    })

    if (linkSession.flow === "launcher") {
      return redirectToLauncherPath(linkSession.redirectPath)
    }

    return new Response(buildPickupAuthResultHtml(false, message), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      status: 500,
    })
  }
}
