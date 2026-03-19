import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  mergeTrackedPlayerIdentity,
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
      const nextPlayer = mergeTrackedPlayerIdentity(
        existingPlayer,
        normalizedPlayerName
      );
      if (nextPlayer === existingPlayer) {
        return false;
      }

      setPlayers(
        players.map((player) =>
          player.steamId === normalizedSteamId
            ? nextPlayer
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
        aliases: [],
        addedAt: new Date().toISOString(),
        note: "",
      },
    ]);
    return true;
  }

  function syncPlayerNames(nextPlayerNames: Record<string, string>) {
    let hasChanged = false;

    const nextPlayers = players.map((player) => {
      const nextPlayerName = nextPlayerNames[player.steamId];
      if (!nextPlayerName) {
        return player;
      }

      const nextPlayer = mergeTrackedPlayerIdentity(player, nextPlayerName);
      if (nextPlayer !== player) {
        hasChanged = true;
      }

      return nextPlayer;
    });

    if (!hasChanged) {
      return false;
    }

    setPlayers(nextPlayers);
    return true;
  }

  function setPlayerNote(steamId: string, note: string) {
    const normalizedSteamId = steamId.trim();
    const normalizedNote = note.trim().slice(0, 500);
    let hasChanged = false;

    const nextPlayers = players.map((player) => {
      if (player.steamId !== normalizedSteamId) {
        return player;
      }

      if (player.note === normalizedNote) {
        return player;
      }

      hasChanged = true;
      return {
        ...player,
        note: normalizedNote,
      };
    });

    if (!hasChanged) {
      return false;
    }

    setPlayers(nextPlayers);
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
    syncPlayerNames,
    setPlayerNote,
    untrackPlayer,
  };
}
