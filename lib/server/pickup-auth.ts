import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import type { PickupPlayer } from "@prisma/client"

import {
  createOauthState,
  createOpaqueToken,
  hashOpaqueToken,
} from "@/lib/server/auth"
import { getNotificationEnv, getPickupAdminSteamIds } from "@/lib/server/env"
import { RouteError, routeError } from "@/lib/server/errors"
import { getPrisma } from "@/lib/server/prisma"

const PICKUP_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 90
const PICKUP_LINK_SESSION_DURATION_MS = 1000 * 60 * 10

export function isPickupAuthDebugEnabled() {
  const fromEnv = getNotificationEnv().PICKUP_AUTH_DEBUG.trim() === "1"
  return fromEnv || process.env.NODE_ENV === "development"
}

/** Safe diagnostics only — never log session tokens or STEAM keys. */
export function logPickupAuthDebug(
  message: string,
  meta?: Record<string, unknown>
) {
  if (!isPickupAuthDebugEnabled()) {
    return
  }

  if (meta && Object.keys(meta).length > 0) {
    console.info(`[pickup-auth:debug] ${message}`, meta)
  } else {
    console.info(`[pickup-auth:debug] ${message}`)
  }
}

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

/**
 * When Cloudflare/nginx forwards to Node, `request.url` is often http://localhost:3000/...
 * while the browser used https://qltracker.com. Next.js rejects Set-Cookie with
 * Domain=qltracker.com for that internal host, so the cookie never reaches the client.
 * Omit Domain in that case; the browser still scopes the cookie to the public host.
 */
function shouldOmitCookieDomainForRequest(request: Request | undefined): boolean {
  if (!request) {
    return false
  }

  let publicHost: string
  try {
    publicHost = new URL(getNotificationEnv().PUBLIC_BASE_URL).hostname.toLowerCase()
  } catch {
    return false
  }

  if (!publicHost || publicHost === "localhost" || publicHost === "127.0.0.1") {
    return false
  }

  try {
    const requestHost = new URL(request.url).hostname.toLowerCase()
    return requestHost !== publicHost
  } catch {
    return false
  }
}

/** Treat as HTTPS when TLS terminates at Cloudflare/nginx and Node sees http://localhost. */
function isRequestEffectivelyHttps(request: Request | undefined): boolean {
  if (!request) {
    return false
  }

  const forwarded = request.headers.get("x-forwarded-proto")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase()
    if (first === "https") {
      return true
    }
    if (first === "http") {
      return false
    }
  }

  try {
    return new URL(request.url).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * `Secure` must match what the browser used. If we only look at `NODE_ENV` + PUBLIC_BASE_URL,
 * we set `Secure` while Next still sees `http://localhost:3000` — the cookie is dropped.
 * Prefer `x-forwarded-proto` when present.
 */
function shouldUseSecurePickupCookie(
  request: Request | undefined,
  publicBaseUrl: string
): boolean {
  if (request) {
    return isRequestEffectivelyHttps(request)
  }

  return (
    process.env.NODE_ENV === "production" || isHttpsPublicUrl(publicBaseUrl)
  )
}

/** Use for Set-Cookie on browser pickup sessions (Steam callback, etc.). */
export function getPickupSessionCookieSetOptions(request?: Request) {
  const env = getNotificationEnv()
  const publicBaseUrl = env.PUBLIC_BASE_URL.replace(/\/$/, "")
  const omitDomain = shouldOmitCookieDomainForRequest(request)
  const domain = omitDomain ? undefined : resolvePickupAuthCookieDomain()
  const secure = shouldUseSecurePickupCookie(request, publicBaseUrl)

  if (isPickupAuthDebugEnabled()) {
    if (omitDomain) {
      logPickupAuthDebug(
        "getPickupSessionCookieSetOptions: omitting Domain (request.url host ≠ PUBLIC_BASE_URL host; reverse proxy / Cloudflare)"
      )
    }
    logPickupAuthDebug("getPickupSessionCookieSetOptions: secure flag", {
      secure,
      requestUrlProtocol: (() => {
        try {
          return new URL(request?.url ?? "about:blank").protocol
        } catch {
          return "invalid"
        }
      })(),
      xForwardedProto: request?.headers.get("x-forwarded-proto") ?? null,
    })
  }

  return {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 90,
    path: "/",
    sameSite: "lax" as const,
    secure,
    ...(domain ? { domain } : {}),
  }
}

export type PickupSessionCookieSetOpts = ReturnType<
  typeof getPickupSessionCookieSetOptions
>

/**
 * Single `Set-Cookie` header value (name=value; attributes…).
 * Use in Route Handlers when `NextResponse.cookies.set` is dropped or merged wrong behind
 * Traefik / Cloudflare / Docker (see e.g. Next.js issues on wrong `request.url` behind LB).
 */
export function serializePickupSessionSetCookie(
  name: string,
  value: string,
  opts: PickupSessionCookieSetOpts
): string {
  const parts: string[] = [`${name}=${encodeURIComponent(value)}`]
  parts.push(`Path=${opts.path}`)
  if (typeof opts.maxAge === "number") {
    parts.push(`Max-Age=${opts.maxAge}`)
  }
  if (opts.httpOnly) {
    parts.push("HttpOnly")
  }
  if (opts.secure) {
    parts.push("Secure")
  }
  const ss = opts.sameSite
  if (ss === "lax") {
    parts.push("SameSite=Lax")
  } else if (ss === "strict") {
    parts.push("SameSite=Strict")
  } else if (ss === "none") {
    parts.push("SameSite=None")
  }
  if ("domain" in opts && opts.domain) {
    parts.push(`Domain=${opts.domain}`)
  }
  return parts.join("; ")
}

/**
 * Revoke pickup admin session in DB, clear httpOnly cookie, redirect to login.
 * Call from **POST** only in Route Handlers: a GET `/admin/logout` + Next.js `<Link prefetch>`
 * will fire this during prefetch and log the user out immediately (session + cookie gone).
 */
export async function performPickupAdminBrowserLogout(request: Request) {
  const cookieStore = await cookies()
  const env = getNotificationEnv()
  const cookieName = env.PICKUP_AUTH_COOKIE_NAME
  const token = cookieStore.get(cookieName)?.value

  if (token) {
    await invalidatePickupSession(token)
  }

  const delOpts = getPickupSessionCookieDeleteOptions(request)
  const loginUrl = new URL(
    "/admin/login",
    env.PUBLIC_BASE_URL.replace(/\/$/, "")
  )
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: loginUrl.toString(),
      "Set-Cookie": serializePickupSessionSetCookie(
        cookieName,
        "",
        delOpts as PickupSessionCookieSetOpts
      ),
    },
  })
}

/** Clear cookie with the same domain/path/secure as login so the browser actually drops it. */
export function getPickupSessionCookieDeleteOptions(request?: Request) {
  const opts = getPickupSessionCookieSetOptions(request)
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
    logPickupAuthDebug("getPickupBrowserSession: missing cookie", {
      cookieName,
      cookieNamesPresent: cookieStore.getAll().map((c) => c.name),
    })
    return null
  }

  try {
    return await requirePickupSessionByToken(token)
  } catch (error) {
    const cause =
      error instanceof RouteError
        ? { status: error.status, message: error.message }
        : { message: error instanceof Error ? error.message : String(error) }
    logPickupAuthDebug("getPickupBrowserSession: token not accepted", {
      cookieName,
      tokenLength: token.length,
      ...cause,
    })
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
