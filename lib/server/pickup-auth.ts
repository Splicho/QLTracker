import { cookies } from "next/headers"
import type { PickupPlayer } from "@prisma/client"

import {
  createOauthState,
  createOpaqueToken,
  hashOpaqueToken,
} from "@/lib/server/auth"
import { getNotificationEnv, getPickupAdminSteamIds } from "@/lib/server/env"
import { routeError } from "@/lib/server/errors"
import { getPrisma } from "@/lib/server/prisma"

const PICKUP_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 90
const PICKUP_LINK_SESSION_DURATION_MS = 1000 * 60 * 10

export type AuthenticatedPickupSession = {
  sessionId: string
  token: string
  player: PickupPlayer
  isAdmin: boolean
}

function hashPickupToken(token: string) {
  const env = getNotificationEnv()
  return hashOpaqueToken(`pickup:${token}`, env.SESSION_SECRET)
}

function isHttpsPublicUrl(publicBaseUrl: string) {
  try {
    return new URL(publicBaseUrl).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Optional registrable domain so the session cookie is sent on both www and apex
 * (e.g. Domain=qltracker.com). Omit on localhost or multi-label hosts we can't infer safely.
 */
function resolvePickupAuthCookieDomain(): string | undefined {
  const explicit = getNotificationEnv().PICKUP_AUTH_COOKIE_DOMAIN.trim()
  if (explicit) {
    return explicit.replace(/^\./, "") || undefined
  }

  try {
    const host = new URL(getNotificationEnv().PUBLIC_BASE_URL).hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1") {
      return undefined
    }

    const parts = host.split(".")
    if (parts.length === 2) {
      return host
    }
    if (parts.length === 3 && parts[0] === "www") {
      return `${parts[1]}.${parts[2]}`
    }

    return undefined
  } catch {
    return undefined
  }
}

/** Use for Set-Cookie on browser pickup sessions (Steam callback, etc.). */
export function getPickupSessionCookieSetOptions() {
  const env = getNotificationEnv()
  const publicBaseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, "")
  const domain = resolvePickupAuthCookieDomain()
  const secure =
    process.env.NODE_ENV === "production" || isHttpsPublicUrl(publicBaseUrl)

  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax" as const,
    secure,
    ...(domain ? { domain } : {}),
  }
}

/** Clear cookie with the same domain/path/secure as login so the browser actually drops it. */
export function getPickupSessionCookieDeleteOptions() {
  const opts = getPickupSessionCookieSetOptions()
  return {
    ...opts,
    expires: new Date(0),
    maxAge: 0,
  }
}

export function createPickupOauthState() {
  return createOauthState()
}

export function getPickupLinkSessionExpiry() {
  return new Date(Date.now() + PICKUP_LINK_SESSION_DURATION_MS)
}

export function isPickupAdminSteamId(steamId: string) {
  return getPickupAdminSteamIds().includes(steamId.trim())
}

export async function createPickupAppSession(playerId: string) {
  const prisma = getPrisma()
  const token = createOpaqueToken()

  await prisma.pickupAppSession.create({
    data: {
      playerId,
      tokenHash: hashPickupToken(token),
      expiresAt: new Date(Date.now() + PICKUP_SESSION_DURATION_MS),
    },
  })

  return token
}

export async function invalidatePickupSession(token: string) {
  const prisma = getPrisma()

  await prisma.pickupAppSession.updateMany({
    where: {
      tokenHash: hashPickupToken(token),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

export async function invalidateAllPickupSessions(playerId: string) {
  await getPrisma().pickupAppSession.updateMany({
    where: {
      playerId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

function extractCookieToken(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null
  }

  const cookieName = getNotificationEnv().PICKUP_AUTH_COOKIE_NAME

  for (const segment of cookieHeader.split(";")) {
    const [name, ...rest] = segment.trim().split("=")
    if (name !== cookieName) {
      continue
    }

    const value = rest.join("=").trim()
    return value.length > 0 ? decodeURIComponent(value) : null
  }

  return null
}

export function extractPickupSessionToken(request: Request) {
  const authorization = request.headers.get("authorization")
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  if (bearerToken) {
    return bearerToken
  }

  return extractCookieToken(request.headers.get("cookie"))
}

async function requirePickupSessionByToken(token: string) {
  const prisma = getPrisma()
  const session = await prisma.pickupAppSession.findFirst({
    where: {
      tokenHash: hashPickupToken(token),
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      player: true,
    },
  })

  if (!session) {
    routeError(401, "Pickup session is invalid.")
  }

  if (!session.player) {
    await prisma.pickupAppSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    })
    routeError(401, "Pickup session is invalid.")
  }

  await prisma.pickupAppSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    sessionId: session.id,
    token,
    player: session.player,
    isAdmin: isPickupAdminSteamId(session.player.steamId),
  } satisfies AuthenticatedPickupSession
}

export async function requirePickupAppSession(request: Request) {
  const token = extractPickupSessionToken(request)

  if (!token) {
    routeError(401, "Missing pickup session token.")
  }

  return requirePickupSessionByToken(token)
}

export async function getPickupBrowserSession() {
  const cookieStore = await cookies()
  const cookieName = getNotificationEnv().PICKUP_AUTH_COOKIE_NAME
  const token = cookieStore.get(cookieName)?.value?.trim()

  if (!token) {
    return null
  }

  try {
    return await requirePickupSessionByToken(token)
  } catch {
    return null
  }
}

export async function requirePickupAdminSession(request: Request) {
  const session = await requirePickupAppSession(request)

  if (!session.isAdmin) {
    routeError(403, "Pickup admin access is required.")
  }

  return session
}
