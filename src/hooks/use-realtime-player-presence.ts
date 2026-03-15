import { useEffect, useState } from "react";
import {
  fetchRealtimePlayerPresence,
  getRealtimeSocket,
  isRealtimeEnabled,
  type RealtimePlayerPresence,
} from "@/lib/realtime";

type PlayerPresencePayload = {
  steamId: string;
  presence: RealtimePlayerPresence | null;
};

export function useRealtimePlayerPresence(steamId: string, enabled = true) {
  const [presence, setPresence] = useState<RealtimePlayerPresence | null>(null);
  const [hasResolved, setHasResolved] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const normalizedSteamId = steamId.trim();
  const canUseRealtime =
    enabled && isRealtimeEnabled() && normalizedSteamId.length > 0;

  useEffect(() => {
    setPresence(null);
    setHasResolved(!canUseRealtime);

    if (!canUseRealtime) {
      setIsConnected(false);
      return;
    }

    const socket = getRealtimeSocket();
    let cancelled = false;

    const hydratePresence = async () => {
      try {
        const nextPresence =
          await fetchRealtimePlayerPresence(normalizedSteamId);
        if (cancelled) {
          return;
        }

        setPresence(nextPresence);
        setHasResolved(true);
      } catch {
        // Keep the query unresolved so callers can fall back to local state.
      }
    };

    if (!socket) {
      void hydratePresence();
      return () => {
        cancelled = true;
      };
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit("presence:subscribe", {
        steamId: normalizedSteamId,
      });
    };
    const handleDisconnect = () => {
      setIsConnected(false);
    };
    const handleConnectError = (error: Error) => {
      console.warn("Realtime presence connection failed:", error.message);
    };
    const handlePresence = (payload: PlayerPresencePayload) => {
      if (payload.steamId !== normalizedSteamId) {
        return;
      }

      setPresence(payload.presence);
      setHasResolved(true);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("player:presence", handlePresence);

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    void hydratePresence();

    return () => {
      cancelled = true;
      socket.emit("presence:unsubscribe", {
        steamId: normalizedSteamId,
      });
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("player:presence", handlePresence);
    };
  }, [canUseRealtime, normalizedSteamId]);

  return {
    presence,
    hasResolved,
    isConnected,
  };
}
