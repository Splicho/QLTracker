import { getPickupSettings } from "@/lib/server/pickup"
import { routeError } from "@/lib/server/errors"

async function getProvisionerConfig() {
  const settings = await getPickupSettings()

  if (!settings.provisionApiUrl) {
    routeError(503, "Provision API URL is not configured.")
  }

  const baseUrl = new URL("/", settings.provisionApiUrl)
    .toString()
    .replace(/\/$/, "")

  return {
    baseUrl,
    authToken: settings.provisionAuthToken,
  }
}

type ProvisionerConfig = Awaited<ReturnType<typeof getProvisionerConfig>>

async function provisionerFetch(
  path: string,
  init?: RequestInit,
  provisionerConfig?: ProvisionerConfig
) {
  const config = provisionerConfig ?? (await getProvisionerConfig())
  const url = `${config.baseUrl}${path}`

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) ?? {}),
  }

  if (config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken}`
  }

  const response = await fetch(url, {
    ...init,
    headers,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error")
    routeError(response.status, `Provisioner error: ${text}`)
  }

  return response.json()
}

export async function getProvisionerSlots() {
  const config = await getProvisionerConfig()
  const data = await provisionerFetch("/healthz", undefined, config)
  const fallbackHost = new URL(config.baseUrl).hostname

  return (data.slots as Array<Record<string, unknown>>).map((slot) => {
    const sanitized = { ...slot }
    delete sanitized.token
    if (
      !sanitized.joinAddress &&
      typeof sanitized.gamePort === "number" &&
      fallbackHost
    ) {
      sanitized.joinAddress = `${fallbackHost}:${sanitized.gamePort}`
    }
    return sanitized
  })
}

export async function getSlotMetadata(slotId: number) {
  const data = await provisionerFetch(`/internal/slots/${slotId}/metadata`)

  const metadata = { ...(data as Record<string, unknown>) }
  delete metadata.callbackToken
  delete metadata.callbackBaseUrl
  return metadata
}

export async function adminStopSlot(slotId: number) {
  return provisionerFetch(`/api/admin/slots/${slotId}/stop`, {
    method: "POST",
  })
}

export async function adminStartManualSlot(
  slotId: number,
  map: string,
  teamSize = 4
) {
  return provisionerFetch(`/api/admin/slots/${slotId}/start-manual`, {
    method: "POST",
    body: JSON.stringify({ map, teamSize }),
  })
}

export async function getSlotEvents(slotId: number, since?: string) {
  const params = since ? `?since=${encodeURIComponent(since)}` : ""
  return provisionerFetch(`/api/admin/slots/${slotId}/events${params}`)
}

export async function sendSlotCommand(
  slotId: number,
  action: string,
  target?: string,
  message?: string
) {
  return provisionerFetch(`/api/admin/slots/${slotId}/command`, {
    method: "POST",
    body: JSON.stringify({ action, target, message }),
  })
}
