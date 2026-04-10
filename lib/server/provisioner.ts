import { getPickupSettings } from "@/lib/server/pickup";
import { routeError } from "@/lib/server/errors";

async function getProvisionerConfig() {
  const settings = await getPickupSettings();

  if (!settings.provisionApiUrl) {
    routeError(503, "Provision API URL is not configured.");
  }

  const baseUrl = new URL("/", settings.provisionApiUrl).toString().replace(/\/$/, "");

  return {
    baseUrl,
    authToken: settings.provisionAuthToken,
  };
}

async function provisionerFetch(path: string, init?: RequestInit) {
  const config = await getProvisionerConfig();
  const url = `${config.baseUrl}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> ?? {}),
  };

  if (config.authToken) {
    headers["Authorization"] = `Bearer ${config.authToken}`;
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    routeError(response.status, `Provisioner error: ${text}`);
  }

  return response.json();
}

export async function getProvisionerSlots() {
  const data = await provisionerFetch("/healthz");

  return (data.slots as Array<Record<string, unknown>>).map(({ token: _token, ...slot }) => slot);
}

export async function getSlotMetadata(slotId: number) {
  const data = await provisionerFetch(`/internal/slots/${slotId}/metadata`);

  const { callbackToken: _callbackToken, callbackBaseUrl: _callbackBaseUrl, ...metadata } = data;
  return metadata;
}

export async function adminStopSlot(slotId: number) {
  return provisionerFetch(`/api/admin/slots/${slotId}/stop`, {
    method: "POST",
  });
}

export async function adminStartManualSlot(slotId: number, map: string, teamSize = 4) {
  return provisionerFetch(`/api/admin/slots/${slotId}/start-manual`, {
    method: "POST",
    body: JSON.stringify({ map, teamSize }),
  });
}

export async function getSlotEvents(slotId: number, since?: string) {
  const params = since ? `?since=${encodeURIComponent(since)}` : "";
  return provisionerFetch(`/api/admin/slots/${slotId}/events${params}`);
}

export async function sendSlotCommand(slotId: number, action: string, target?: string, message?: string) {
  return provisionerFetch(`/api/admin/slots/${slotId}/command`, {
    method: "POST",
    body: JSON.stringify({ action, target, message }),
  });
}
