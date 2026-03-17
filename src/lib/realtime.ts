import { io, type Socket } from "socket.io-client";
import { appendErrorLog } from "@/lib/error-log";

const realtimeUrl = import.meta.env.VITE_REALTIME_URL?.trim() ?? "";

let socket: Socket | null = null;

export type RealtimePlayerPresence = {
  steamId: string;
  playerName: string;
  addr: string;
  serverName: string;
  map: string;
  gameMode: string | null;
  team: number | null;
  players: number;
  maxPlayers: number;
  countryCode: string | null;
  countryName: string | null;
  updatedAt: string;
};

export type ServerHistoryPoint = {
  timestamp: string;
  players: number;
  maxPlayers: number;
  map: string | null;
  gameMode: string | null;
};

export type ServerHistorySummary = {
  lastSeenAt: string | null;
  peakPlayers: number;
  populatedSampleRatio: number;
};

type RealtimePresenceResponse = {
  ok: boolean;
  presence: RealtimePlayerPresence | null;
};

type RealtimePresenceLookupResponse = {
  ok: boolean;
  presences: Record<string, RealtimePlayerPresence | null>;
};

type RealtimeServerHistoryResponse = {
  ok: boolean;
  summary: ServerHistorySummary | null;
  timeline: ServerHistoryPoint[];
};

export function isRealtimeEnabled() {
  return realtimeUrl.length > 0;
}

export function getRealtimeSocket() {
  if (!isRealtimeEnabled()) {
    return null;
  }

  if (socket) {
    return socket;
  }

  socket = io(realtimeUrl, {
    autoConnect: false,
    reconnection: true,
    transports: ["websocket"],
  });

  return socket;
}

export async function fetchRealtimePlayerPresence(steamId: string) {
  if (!isRealtimeEnabled()) {
    return null;
  }

  try {
    const response = await fetch(
      `${realtimeUrl}/api/presence/${encodeURIComponent(steamId)}`
    );

    if (!response.ok) {
      throw new Error(`Realtime presence failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as RealtimePresenceResponse;
    return payload.presence ?? null;
  } catch (error) {
    await appendErrorLog("realtime.presence", {
      steamId,
      realtimeUrl,
      error:
        error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function fetchRealtimePlayerPresenceLookup(steamIds: string[]) {
  if (!isRealtimeEnabled() || steamIds.length === 0) {
    return {};
  }

  try {
    const response = await fetch(`${realtimeUrl}/api/presence/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        steamIds,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Realtime presence lookup failed with HTTP ${response.status}.`
      );
    }

    const payload = (await response.json()) as RealtimePresenceLookupResponse;
    return payload.presences ?? {};
  } catch (error) {
    await appendErrorLog("realtime.presenceLookup", {
      steamIds,
      realtimeUrl,
      error:
        error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function fetchRealtimeServerHistory(
  addr: string,
  range = "7d",
  bucket = "15m"
) {
  if (!isRealtimeEnabled()) {
    const error = new Error("Realtime history is unavailable.");
    await appendErrorLog("realtime.serverHistory", {
      addr,
      range,
      bucket,
      realtimeUrl,
      error: error.message,
    });
    throw error;
  }

  const searchParams = new URLSearchParams({
    range,
    bucket,
  });

  try {
    const response = await fetch(
      `${realtimeUrl}/api/servers/${encodeURIComponent(addr)}/history?${searchParams.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Realtime history failed with HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as RealtimeServerHistoryResponse;
    return {
      summary: payload.summary,
      timeline: payload.timeline ?? [],
    };
  } catch (error) {
    await appendErrorLog("realtime.serverHistory", {
      addr,
      range,
      bucket,
      realtimeUrl,
      error:
        error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
