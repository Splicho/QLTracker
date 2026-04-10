import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeSnapshots } from "@/hooks/use-realtime-snapshots";
import {
  fetchSteamServers,
  mergeSteamServerSnapshot,
  type SteamServer,
} from "@/lib/steam";

export const steamQueryKeys = {
  servers: ["steam", "servers"] as const,
};

export function useLiveServers(initialServers?: SteamServer[]) {
  const serversQuery = useQuery({
    queryKey: steamQueryKeys.servers,
    queryFn: () => fetchSteamServers(""),
    initialData: initialServers,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const baseServers = serversQuery.data ?? [];
  const { isConnected, snapshotsByAddr } = useRealtimeSnapshots(baseServers);
  const servers = useMemo(
    () =>
      baseServers.map((server) => {
        const snapshot = snapshotsByAddr[server.addr];
        return snapshot ? mergeSteamServerSnapshot(server, snapshot) : server;
      }),
    [baseServers, snapshotsByAddr],
  );

  return {
    error:
      serversQuery.error instanceof Error
        ? serversQuery.error.message
        : serversQuery.error
          ? "Server discovery failed."
          : null,
    isLoading: serversQuery.isPending,
    isRealtimeConnected: isConnected,
    isRefreshing: serversQuery.fetchStatus === "fetching" && !serversQuery.isPending,
    refetch: () => {
      void serversQuery.refetch();
    },
    servers,
  };
}
