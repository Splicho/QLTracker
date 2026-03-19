import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTrackedPlayers } from "@/hooks/use-tracked-players";
import {
  fetchRealtimePlayerPresenceLookup,
  isRealtimeEnabled,
} from "@/lib/realtime";

export function useTrackedPlayerIdentitySync() {
  const { players, syncPlayerNames } = useTrackedPlayers();
  const realtimeAvailable = isRealtimeEnabled();
  const trackedSteamIds = useMemo(
    () => players.map((player) => player.steamId),
    [players]
  );
  const presenceQuery = useQuery({
    queryKey: ["realtime", "presence-lookup", trackedSteamIds],
    queryFn: () => fetchRealtimePlayerPresenceLookup(trackedSteamIds),
    enabled: realtimeAvailable && trackedSteamIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (!presenceQuery.data) {
      return;
    }

    const nextPlayerNames = Object.fromEntries(
      Object.values(presenceQuery.data)
        .filter((presence) => presence?.steamId && presence.playerName.trim())
        .map((presence) => [presence!.steamId, presence!.playerName])
    );

    if (Object.keys(nextPlayerNames).length === 0) {
      return;
    }

    syncPlayerNames(nextPlayerNames);
  }, [presenceQuery.data, syncPlayerNames]);
}
