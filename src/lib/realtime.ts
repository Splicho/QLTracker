import { io, type Socket } from "socket.io-client";

const realtimeUrl = import.meta.env.VITE_REALTIME_URL?.trim() ?? "";

let socket: Socket | null = null;

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
