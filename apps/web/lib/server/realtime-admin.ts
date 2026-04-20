import crypto from "node:crypto"

import { routeError } from "@/lib/server/errors"
import { getPickupSettings } from "@/lib/server/pickup"

const PICKUP_CALLBACK_SIGNATURE_HEADER = "x-pickup-signature"

export type RealtimeAbortPickupResult = {
  aborted: boolean
  matchId: string
  ok: boolean
  previousStatus?: string
  status: string
  warning?: string
}

function createPickupSignature(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex")
}

function getRealtimeBaseUrl() {
  const value = process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "")

  if (!value) {
    routeError(503, "NEXT_PUBLIC_REALTIME_URL is not configured.")
  }

  return value
}

export async function abortRealtimePickupMatch(
  matchId: string,
  adminSteamId: string
): Promise<RealtimeAbortPickupResult> {
  const settings = await getPickupSettings()
  if (!settings.callbackSecret) {
    routeError(503, "Pickup callback secret is not configured.")
  }

  const body = JSON.stringify({
    adminSteamId,
    matchId,
    reason: "admin-abort",
    requestedAt: new Date().toISOString(),
  })
  const response = await fetch(
    `${getRealtimeBaseUrl()}/api/pickup/admin/matches/abort`,
    {
      body,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        [PICKUP_CALLBACK_SIGNATURE_HEADER]: createPickupSignature(
          settings.callbackSecret,
          body
        ),
      },
      method: "POST",
    }
  )

  const text = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {}
  } catch {
    data = { error: text }
  }
  if (!response.ok) {
    routeError(
      response.status,
      typeof data.error === "string" ? data.error : "Realtime abort failed."
    )
  }

  return data as RealtimeAbortPickupResult
}
