import { io, type Socket } from "socket.io-client";
import { appendPickupLog } from "@/lib/pickup-log";
import { appendRealtimeLog } from "@/lib/realtime-log";

const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "") ?? "";
const realtimeApiBasePath = "/api/realtime";

let socket: Socket | null = null;
let pickupToken = "";

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

export type PlayerNameHistoryEntry = {
  playerName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenAddr: string | null;
  lastSeenServerName: string | null;
  seenCount: number;
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

type RealtimePlayerNameHistoryLookupResponse = {
  ok: boolean;
  histories: Record<string, PlayerNameHistoryEntry[]>;
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
    auth: {
      pickupToken,
    },
    reconnection: true,
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    void appendRealtimeLog("realtime.socket.connect", {
      connected: socket?.connected ?? false,
      socketId: socket?.id ?? null,
      transport: socket?.io.engine?.transport.name ?? null,
    });
  });

  socket.on("disconnect", (reason) => {
    void appendRealtimeLog("realtime.socket.disconnect", {
      reason,
      socketId: socket?.id ?? null,
    });
  });

  socket.on("connect_error", (error) => {
    void appendRealtimeLog("realtime.socket.connect_error", {
      message: error.message,
      name: error.name,
    });
  });

  void appendRealtimeLog("realtime.socket.created", {
    pickupTokenPresent: pickupToken.length > 0,
    realtimeUrl,
  });

  return socket;
}

export function setRealtimePickupToken(nextToken: string) {
  pickupToken = nextToken.trim();
  void appendPickupLog("realtime.pickup_token.updated", {
    pickupTokenPresent: pickupToken.length > 0,
    pickupTokenLength: pickupToken.length,
    socketExists: socket !== null,
  });

  if (!socket) {
    return;
  }

  socket.auth = {
    ...(typeof socket.auth === "object" && socket.auth ? socket.auth : {}),
    pickupToken,
  };

  if (socket.connected) {
    void appendPickupLog("realtime.pickup_token.reconnect", {
      socketId: socket.id ?? null,
    });
    socket.disconnect().connect();
  }
}

async function realtimeGet<T>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Realtime request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function realtimePost<T>(url: string, body: unknown) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Realtime request failed with HTTP ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function fetchRealtimePlayerPresence(steamId: string) {
  if (!isRealtimeEnabled()) {
    return null;
  }

  try {
    const payload = await realtimeGet<RealtimePresenceResponse>(
      `${realtimeApiBasePath}/presence/${encodeURIComponent(steamId)}`
    );
    return payload.presence ?? null;
  } catch (error) {
    await appendRealtimeLog("realtime.presence.error", {
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
    const payload = await realtimePost<RealtimePresenceLookupResponse>(
      `${realtimeApiBasePath}/presence/lookup`,
      {
        steamIds,
      }
    );
    return payload.presences ?? {};
  } catch (error) {
    await appendRealtimeLog("realtime.presenceLookup.error", {
      steamIds,
      realtimeUrl,
      error:
        error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function fetchRealtimePlayerNameHistoryLookup(steamIds: string[]) {
  if (!isRealtimeEnabled() || steamIds.length === 0) {
    return {};
  }

  try {
    const payload = await realtimePost<RealtimePlayerNameHistoryLookupResponse>(
      `${realtimeApiBasePath}/players/name-history/lookup`,
      {
        steamIds,
      }
    );
    return payload.histories ?? {};
  } catch (error) {
    await appendRealtimeLog("realtime.playerNameHistoryLookup.error", {
      steamIds,
      realtimeUrl,
      error: error instanceof Error ? error.message : String(error),
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
    await appendRealtimeLog("realtime.serverHistory.error", {
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
    const payload = await realtimeGet<RealtimeServerHistoryResponse>(
      `${realtimeApiBasePath}/servers/${encodeURIComponent(addr)}/history?${searchParams.toString()}`
    );
    return {
      summary: payload.summary,
      timeline: payload.timeline ?? [],
    };
  } catch (error) {
    await appendRealtimeLog("realtime.serverHistory.error", {
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
