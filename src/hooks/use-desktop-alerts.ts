import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFavorites } from "@/hooks/use-favorites";
import { useTrackedPlayers } from "@/hooks/use-tracked-players";
import { primeDesktopNotificationPermission, sendDesktopNotification } from "@/lib/native-notifications";
import { stripQuakeColors } from "@/lib/quake";
import {
  fetchRealtimePlayerPresenceLookup,
  isRealtimeEnabled,
  type RealtimePlayerPresence,
} from "@/lib/realtime";
import { getGameModeLabel } from "@/lib/server-utils";
import type { AppSettingsValue } from "@/lib/settings";
import type { SteamServer } from "@/lib/steam";

const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

type UseDesktopAlertsOptions = {
  servers: SteamServer[];
  settings: Pick<
    AppSettingsValue,
    | "desktopAlertsEnabled"
    | "desktopAlertsPaused"
    | "desktopAlertsTrackedPlayers"
    | "desktopAlertsFavoriteServers"
    | "favoriteServerAlertMinPlayers"
  >;
};

type FavoriteAlertSnapshot = {
  addr: string;
  map: string;
  name: string;
  players: number;
};

function sanitizeLabel(value: string | null | undefined, fallback: string) {
  const sanitized = stripQuakeColors(value ?? "").trim();
  return sanitized || fallback;
}

export function useDesktopAlerts({
  servers,
  settings,
}: UseDesktopAlertsOptions) {
  const { t } = useTranslation();
  const { state: favoritesState } = useFavorites();
  const { players: trackedPlayers } = useTrackedPlayers();
  const realtimeAvailable = isRealtimeEnabled();
  const serverByAddr = useMemo(
    () => Object.fromEntries(servers.map((server) => [server.addr, server])),
    [servers]
  );
  const trackedSteamIds = useMemo(
    () => trackedPlayers.map((player) => player.steamId),
    [trackedPlayers]
  );
  const lastAlertAtRef = useRef<Record<string, number>>({});
  const trackedBaselineRef = useRef<Record<string, RealtimePlayerPresence | null>>(
    {}
  );
  const favoriteBaselineRef = useRef<Record<string, FavoriteAlertSnapshot>>({});

  const trackedPresenceQuery = useQuery({
    queryKey: ["realtime", "presence-lookup", trackedSteamIds],
    queryFn: () => fetchRealtimePlayerPresenceLookup(trackedSteamIds),
    enabled:
      settings.desktopAlertsEnabled &&
      !settings.desktopAlertsPaused &&
      settings.desktopAlertsTrackedPlayers &&
      realtimeAvailable &&
      trackedSteamIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });

  const favoriteSnapshots = useMemo<Record<string, FavoriteAlertSnapshot>>(
    () =>
      Object.fromEntries(
        favoritesState.servers.map((favoriteServer) => {
          const liveServer = serverByAddr[favoriteServer.addr] ?? null;
          return [
            favoriteServer.addr,
            {
              addr: favoriteServer.addr,
              name: sanitizeLabel(
                liveServer?.name ?? favoriteServer.name,
                favoriteServer.addr
              ),
              map: sanitizeLabel(
                liveServer?.map ?? favoriteServer.map,
                t("header.unknown")
              ),
              players: liveServer?.players ?? 0,
            },
          ];
        })
      ),
    [favoritesState.servers, serverByAddr, t]
  );

  useEffect(() => {
    if (!settings.desktopAlertsEnabled || settings.desktopAlertsPaused) {
      return;
    }

    void primeDesktopNotificationPermission();
  }, [settings.desktopAlertsEnabled, settings.desktopAlertsPaused]);

  useEffect(() => {
    if (
      !settings.desktopAlertsEnabled ||
      settings.desktopAlertsPaused ||
      !settings.desktopAlertsTrackedPlayers ||
      !realtimeAvailable
    ) {
      trackedBaselineRef.current = {};
      return;
    }

    const currentPresenceBySteamId = trackedPresenceQuery.data;
    if (!currentPresenceBySteamId) {
      return;
    }

    const nextBaseline: Record<string, RealtimePlayerPresence | null> = {};
    const queuedAlerts: Array<{ key: string; title: string; body: string }> = [];

    for (const trackedPlayer of trackedPlayers) {
      const currentPresence =
        currentPresenceBySteamId[trackedPlayer.steamId] ?? null;
      const previousPresence = trackedBaselineRef.current[trackedPlayer.steamId];
      nextBaseline[trackedPlayer.steamId] = currentPresence;

      if (previousPresence === undefined || currentPresence == null) {
        continue;
      }

      if (previousPresence?.addr === currentPresence.addr) {
        continue;
      }

      const alertKey = `tracked:${trackedPlayer.steamId}`;
      const now = Date.now();
      if ((lastAlertAtRef.current[alertKey] ?? 0) + ALERT_COOLDOWN_MS > now) {
        continue;
      }

      lastAlertAtRef.current[alertKey] = now;
      const currentServer = serverByAddr[currentPresence.addr] ?? null;
      const modeLabel =
        getGameModeLabel(currentPresence.gameMode, t) ?? t("serverList.modeUnknown");
      queuedAlerts.push({
        key: alertKey,
        title: t("desktopAlerts.trackedPlayerTitle", {
          player: sanitizeLabel(trackedPlayer.playerName, trackedPlayer.steamId),
        }),
        body: t("desktopAlerts.trackedPlayerBody", {
          server: sanitizeLabel(
            currentServer?.name ?? currentPresence.serverName,
            currentPresence.addr
          ),
          map: sanitizeLabel(
            currentServer?.map ?? currentPresence.map,
            t("header.unknown")
          ),
          mode: modeLabel,
        }),
      });
    }

    trackedBaselineRef.current = nextBaseline;

    if (queuedAlerts.length === 0) {
      return;
    }

    void (async () => {
      for (const alert of queuedAlerts) {
        await sendDesktopNotification({
          title: alert.title,
          body: alert.body,
        });
      }
    })();
  }, [
    realtimeAvailable,
    serverByAddr,
    settings.desktopAlertsEnabled,
    settings.desktopAlertsPaused,
    settings.desktopAlertsTrackedPlayers,
    t,
    trackedPlayers,
    trackedPresenceQuery.data,
  ]);

  useEffect(() => {
    if (
      !settings.desktopAlertsEnabled ||
      settings.desktopAlertsPaused ||
      !settings.desktopAlertsFavoriteServers
    ) {
      favoriteBaselineRef.current = {};
      return;
    }

    const queuedAlerts: Array<{ title: string; body: string }> = [];
    const nextBaseline: Record<string, FavoriteAlertSnapshot> = {};

    for (const [addr, snapshot] of Object.entries(favoriteSnapshots)) {
      const previousSnapshot = favoriteBaselineRef.current[addr];
      nextBaseline[addr] = snapshot;

      if (!previousSnapshot) {
        continue;
      }

      if (
        previousSnapshot.players >= settings.favoriteServerAlertMinPlayers ||
        snapshot.players < settings.favoriteServerAlertMinPlayers
      ) {
        continue;
      }

      const alertKey = `favorite:${addr}`;
      const now = Date.now();
      if ((lastAlertAtRef.current[alertKey] ?? 0) + ALERT_COOLDOWN_MS > now) {
        continue;
      }

      lastAlertAtRef.current[alertKey] = now;
      queuedAlerts.push({
        title: t("desktopAlerts.favoriteServerTitle", {
          server: snapshot.name,
        }),
        body: t("desktopAlerts.favoriteServerBody", {
          count: snapshot.players,
          map: snapshot.map,
        }),
      });
    }

    favoriteBaselineRef.current = nextBaseline;

    if (queuedAlerts.length === 0) {
      return;
    }

    void (async () => {
      for (const alert of queuedAlerts) {
        await sendDesktopNotification(alert);
      }
    })();
  }, [
    favoriteSnapshots,
    settings.desktopAlertsEnabled,
    settings.desktopAlertsFavoriteServers,
    settings.desktopAlertsPaused,
    settings.favoriteServerAlertMinPlayers,
    t,
  ]);
}
