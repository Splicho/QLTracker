import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  parseTrackedPlayers,
  serializeTrackedPlayers,
  TRACKED_PLAYERS_STORAGE_KEY,
  type TrackedPlayer,
} from "@/lib/tracked-players";

export function useTrackedPlayers() {
  const [rawValue, setRawValue] = useLocalStorage(
    TRACKED_PLAYERS_STORAGE_KEY,
    serializeTrackedPlayers([])
  );
  const players = useMemo(() => parseTrackedPlayers(rawValue), [rawValue]);

  function setPlayers(nextPlayers: TrackedPlayer[]) {
    setRawValue(serializeTrackedPlayers(nextPlayers));
  }

  function isTracked(steamId: string) {
    const normalizedSteamId = steamId.trim();
    return players.some((player) => player.steamId === normalizedSteamId);
  }

  function trackPlayer(steamId: string, playerName: string) {
    const normalizedSteamId = steamId.trim();
    const normalizedPlayerName = playerName.trim();
    if (!normalizedSteamId || !normalizedPlayerName) {
      return false;
    }

    const existingPlayer = players.find(
      (player) => player.steamId === normalizedSteamId
    );
    if (existingPlayer) {
      if (existingPlayer.playerName === normalizedPlayerName) {
        return false;
      }

      setPlayers(
        players.map((player) =>
          player.steamId === normalizedSteamId
            ? {
                ...player,
                playerName: normalizedPlayerName,
              }
            : player
        )
      );
      return true;
    }

    setPlayers([
      ...players,
      {
        steamId: normalizedSteamId,
        playerName: normalizedPlayerName,
        addedAt: new Date().toISOString(),
      },
    ]);
    return true;
  }

  function untrackPlayer(steamId: string) {
    const normalizedSteamId = steamId.trim();
    const nextPlayers = players.filter(
      (player) => player.steamId !== normalizedSteamId
    );
    if (nextPlayers.length === players.length) {
      return false;
    }

    setPlayers(nextPlayers);
    return true;
  }

  return {
    players,
    isTracked,
    trackPlayer,
    untrackPlayer,
  };
}
