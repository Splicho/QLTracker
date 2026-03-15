import { io, type Socket } from "socket.io-client";

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

type RealtimePresenceResponse = {
  ok: boolean;
  presence: RealtimePlayerPresence | null;
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

  const response = await fetch(
    `${realtimeUrl}/api/presence/${encodeURIComponent(steamId)}`
  );

  if (!response.ok) {
    throw new Error(`Realtime presence failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as RealtimePresenceResponse;
  return payload.presence ?? null;
}
