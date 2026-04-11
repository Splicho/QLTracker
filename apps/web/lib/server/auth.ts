import crypto from "node:crypto"
import type { User } from "@prisma/client"

import { getNotificationEnv } from "@/lib/server/env"
import { routeError } from "@/lib/server/errors"
import { getPrisma } from "@/lib/server/prisma"

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 90
const LINK_SESSION_DURATION_MS = 1000 * 60 * 10

export type AuthenticatedSession = {
  sessionId: string
  token: string
  user: User
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString("base64url")
}

export function createOauthState() {
  return crypto.randomBytes(24).toString("base64url")
}

export function hashOpaqueToken(token: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(token).digest("hex")
}

export function getLinkSessionExpiry() {
  return new Date(Date.now() + LINK_SESSION_DURATION_MS)
}

export async function createAppSession(userId: string) {
  const prisma = getPrisma()
  const env = getNotificationEnv()
  const token = createOpaqueToken()

  await prisma.appSession.create({
    data: {
      userId,
      tokenHash: hashOpaqueToken(token, env.SESSION_SECRET),
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  })

  return token
}

export async function invalidateSession(token: string) {
  const prisma = getPrisma()
  const env = getNotificationEnv()
  const tokenHash = hashOpaqueToken(token, env.SESSION_SECRET)

  await prisma.appSession.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

export async function invalidateAllUserSessions(userId: string) {
  await getPrisma().appSession.updateMany({
    where: {
      revokedAt: null,
      userId,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

export async function requireAppSession(
  request: Request
): Promise<AuthenticatedSession> {
  const authorization = request.headers.get("authorization")
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()

  if (!token) {
    routeError(401, "Missing notification session token.")
  }

  const prisma = getPrisma()
  const env = getNotificationEnv()
  const tokenHash = hashOpaqueToken(token, env.SESSION_SECRET)
  const session = await prisma.appSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  })

  if (!session) {
    routeError(401, "Notification session is invalid.")
  }

  await prisma.appSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  })

  return {
    sessionId: session.id,
    token,
    user: session.user,
  }
}
