import { useEffect, useMemo, useState } from "react";
import { getRealtimeSocket } from "@/lib/realtime";
import type { RealtimeServerSnapshot, SteamServer } from "@/lib/steam";

export function useRealtimeSnapshots(servers: SteamServer[]) {
  const [snapshotsByAddr, setSnapshotsByAddr] = useState<
    Record<string, RealtimeServerSnapshot>
  >({});
  const [isConnected, setIsConnected] = useState(false);
  const addrs = useMemo(
    () =>
      Array.from(
        new Set(
          servers
            .map((server) => server.addr.trim())
            .filter((value) => value.length > 0)
        )
      ),
    [servers]
  );

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleConnect = () => {
      setIsConnected(true);
      if (addrs.length > 0) {
        socket.emit("servers:subscribe", { addrs });
      }
    };
    const handleDisconnect = () => {
      setIsConnected(false);
    };
    const handleSnapshot = (snapshot: RealtimeServerSnapshot) => {
      setSnapshotsByAddr((current) => ({
        ...current,
        [snapshot.addr]: snapshot,
      }));
    };
    const handleConnectError = (error: Error) => {
      console.warn("Realtime connection failed:", error.message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("server:snapshot", handleSnapshot);

    if (!socket.connected) {
      socket.connect();
    } else {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("server:snapshot", handleSnapshot);
    };
  }, [addrs]);

  return {
    isConnected,
    snapshotsByAddr,
  };
}
