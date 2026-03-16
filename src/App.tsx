import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  createDefaultServerFilters,
  ServerFilters,
} from "@/components/server/server-filters";
import { ServerList } from "@/components/server/server-list";
import { FavoritesPage } from "@/components/pages/favorites-page";
import { NotificationsPage } from "@/components/pages/notifications-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useDiscordPresence } from "@/hooks/use-discord-presence";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRealtimePlayerPresence } from "@/hooks/use-realtime-player-presence";
import { useRealtimeSnapshots } from "@/hooks/use-realtime-snapshots";
import type { DiscordPresenceServerContext } from "@/lib/discord-presence";
import type { PageId } from "@/lib/navigation";
import { isRealtimeEnabled } from "@/lib/realtime";
import {
  parseStoredServerFilters,
  serializeServerFilters,
  SERVER_FILTERS_STORAGE_KEY,
} from "@/lib/server-filters-storage";
import {
  fetchSteamServers,
  isQuakeLiveRunning,
  mergeSteamServerSnapshot,
  type SteamServer,
} from "@/lib/steam";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

const steamApiKey = import.meta.env.VITE_STEAM_API_KEY?.trim() ?? "";
const steamAppId =
  Number(import.meta.env.VITE_STEAM_APP_ID?.trim() ?? "282440") || 282440;

const modeLabelKeys: Record<string, string> = {
  ca: "filters.modes.ca",
  duel: "filters.modes.duel",
  ffa: "filters.modes.ffa",
  tdm: "filters.modes.tdm",
  ctf: "filters.modes.ctf",
  ad: "filters.modes.ad",
  dom: "filters.modes.dom",
  ft: "filters.modes.ft",
  har: "filters.modes.har",
  race: "filters.modes.race",
  rr: "filters.modes.rr",
  td: "filters.modes.tdm",
  "1f": "filters.modes.ctf",
};

function getQueryErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : JSON.stringify(error);
  }

  return null;
}

function getDiscordModeLabel(
  gameMode: string | null | undefined,
  t: (key: string) => string
) {
  if (!gameMode) {
    return null;
  }

  const normalizedMode = gameMode.trim().toLowerCase();
  const key = modeLabelKeys[normalizedMode];

  return key ? t(key) : normalizedMode.toUpperCase();
}

function createPresenceFallbackServer(
  addr: string,
  serverName: string,
  map: string,
  players: number,
  maxPlayers: number
): SteamServer {
  return {
    addr,
    steamid: null,
    name: serverName,
    map,
    game_directory: "baseq3",
    game_description: "Quake Live",
    app_id: steamAppId,
    players,
    max_players: maxPlayers,
    bots: 0,
    ping_ms: null,
    region: null,
    version: null,
    keywords: null,
    connect_url: `steam://connect/${addr}`,
    players_info: [],
  };
}

export function App() {
  const { t } = useTranslation();
  const [page, setPage] = useState<PageId>("server-list");
  const [activePresenceSession, setActivePresenceSession] = useState<{
    addr: string;
    modeLabel: string | null;
    fallbackServer: SteamServer;
  } | null>(null);
  const [isTrackedQuakeLiveRunning, setIsTrackedQuakeLiveRunning] = useState<
    boolean | null
  >(null);
  const { settings } = useAppSettings();
  const trackedPresenceSteamId = settings.discordPresenceSteamId.trim();
  const trackLiveServerPresence =
    settings.discordPresenceEnabled &&
    settings.discordPresenceShowServerDetails &&
    trackedPresenceSteamId.length > 0;
  const hasRealtimePresenceAuthority =
    trackLiveServerPresence && isRealtimeEnabled();
  const [rawFilters, setRawFilters] = useLocalStorage(
    SERVER_FILTERS_STORAGE_KEY,
    serializeServerFilters(createDefaultServerFilters())
  );
  const [filters, setFilters] = useState(() =>
    parseStoredServerFilters(rawFilters)
  );
  useEffect(() => {
    setRawFilters(serializeServerFilters(filters));
  }, [filters, setRawFilters]);
  const serversQuery = useQuery({
    queryKey: ["steam", "servers"],
    queryFn: () => fetchSteamServers(steamApiKey),
    enabled: steamApiKey.length > 0,
    staleTime: 30_000,
    refetchInterval: activePresenceSession ? 15_000 : 60_000,
  });
  const { snapshotsByAddr } = useRealtimeSnapshots(serversQuery.data ?? []);
  const {
    presence: trackedPlayerPresence,
    hasResolved: hasResolvedTrackedPlayerPresence,
  } = useRealtimePlayerPresence(
    trackedPresenceSteamId,
    trackLiveServerPresence
  );
  const mergedServers = useMemo(
    () =>
      (serversQuery.data ?? []).map((server) => {
        const snapshot = snapshotsByAddr[server.addr];
        return snapshot ? mergeSteamServerSnapshot(server, snapshot) : server;
      }),
    [serversQuery.data, snapshotsByAddr]
  );
  const serversErrorMessage = getQueryErrorMessage(serversQuery.error);
  const launchedPresenceServer =
    useMemo<DiscordPresenceServerContext | null>(() => {
      if (!activePresenceSession) {
        return null;
      }

      const liveServer =
        mergedServers.find(
          (server) => server.addr === activePresenceSession.addr
        ) ?? activePresenceSession.fallbackServer;

      return {
        server: liveServer,
        modeLabel: activePresenceSession.modeLabel,
      };
    }, [activePresenceSession, mergedServers]);
  const trackedPresenceServer =
    useMemo<DiscordPresenceServerContext | null>(() => {
      if (!trackedPlayerPresence || isTrackedQuakeLiveRunning === false) {
        return null;
      }

      const liveServer =
        mergedServers.find(
          (server) => server.addr === trackedPlayerPresence.addr
        ) ??
        createPresenceFallbackServer(
          trackedPlayerPresence.addr,
          trackedPlayerPresence.serverName,
          trackedPlayerPresence.map,
          trackedPlayerPresence.players,
          trackedPlayerPresence.maxPlayers
        );

      return {
        server: liveServer,
        modeLabel: getDiscordModeLabel(trackedPlayerPresence.gameMode, t),
      };
    }, [isTrackedQuakeLiveRunning, mergedServers, t, trackedPlayerPresence]);
  const activePresenceServer =
    useMemo<DiscordPresenceServerContext | null>(() => {
      if (hasRealtimePresenceAuthority) {
        if (isTrackedQuakeLiveRunning === false) {
          return null;
        }

        if (trackedPresenceServer) {
          return trackedPresenceServer;
        }

        if (hasResolvedTrackedPlayerPresence) {
          return null;
        }
      }

      return launchedPresenceServer;
    }, [
      hasRealtimePresenceAuthority,
      hasResolvedTrackedPlayerPresence,
      isTrackedQuakeLiveRunning,
      launchedPresenceServer,
      trackedPresenceServer,
    ]);

  useDiscordPresence({
    enabled: settings.discordPresenceEnabled,
    showServerDetails: settings.discordPresenceShowServerDetails,
    page,
    activeServer: activePresenceServer,
  });

  useEffect(() => {
    if (!hasRealtimePresenceAuthority) {
      setIsTrackedQuakeLiveRunning(null);
      return;
    }

    let cancelled = false;
    let startupTimeoutId: number | null = null;
    let intervalId: number | null = null;

    const checkProcessState = async () => {
      try {
        const running = await isQuakeLiveRunning();
        if (!cancelled) {
          setIsTrackedQuakeLiveRunning(running);
        }
      } catch {
        // Ignore process-check failures and keep the last known state.
      }
    };

    const startPolling = () => {
      void checkProcessState();
      intervalId = window.setInterval(() => {
        void checkProcessState();
      }, 5000);
    };

    if (activePresenceSession) {
      startupTimeoutId = window.setTimeout(startPolling, 10000);
    } else {
      startPolling();
    }

    return () => {
      cancelled = true;
      setIsTrackedQuakeLiveRunning(null);
      if (startupTimeoutId != null) {
        window.clearTimeout(startupTimeoutId);
      }
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
    };
  }, [activePresenceSession, hasRealtimePresenceAuthority]);

  useEffect(() => {
    if (!hasRealtimePresenceAuthority || !hasResolvedTrackedPlayerPresence) {
      return;
    }

    setActivePresenceSession(null);
  }, [hasRealtimePresenceAuthority, hasResolvedTrackedPlayerPresence]);

  useEffect(() => {
    if (!activePresenceSession) {
      return;
    }

    let cancelled = false;
    let intervalId: number | null = null;

    const checkSessionState = async () => {
      try {
        const running = await isQuakeLiveRunning();
        if (!cancelled && !running) {
          setActivePresenceSession(null);
        }
      } catch {
        // Ignore process-check failures and keep current presence.
      }
    };

    const startupTimeoutId = window.setTimeout(() => {
      void checkSessionState();
      intervalId = window.setInterval(() => {
        void checkSessionState();
      }, 5000);
    }, 10000);

    return () => {
      cancelled = true;
      window.clearTimeout(startupTimeoutId);
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
    };
  }, [activePresenceSession]);

  const handleNavigate = (nextPage: PageId) => {
    setPage(nextPage);
    setActivePresenceSession(null);
  };

  return (
    <SidebarProvider>
      <div
        style={
          {
            "--sidebar-width": "13.5rem",
            "--sidebar-width-icon": "3rem",
          } as CSSProperties
        }
        className="contents"
      >
        <AppSidebar
          page={page}
          onNavigate={handleNavigate}
          servers={mergedServers}
        />
      </div>
      <SidebarInset className="!z-10 !rounded-tl-[1.5rem] !rounded-bl-[1.5rem] !border-l !border-l-border !shadow-lg">
        <Header page={page} />
        {page === "server-list" ? (
          <>
            <ServerFilters
              value={filters}
              onChange={(next) => {
                setFilters(next);
              }}
              onReset={() => {
                setFilters(createDefaultServerFilters());
              }}
            />
            <ServerList
              servers={mergedServers}
              filters={filters}
              isLoading={serversQuery.isLoading}
              isRefreshing={
                serversQuery.fetchStatus === "fetching" &&
                !serversQuery.isLoading
              }
              onRefresh={() => {
                void serversQuery.refetch();
              }}
              error={
                steamApiKey.length === 0
                  ? "Set VITE_STEAM_API_KEY to load servers."
                  : serversErrorMessage
              }
              onServerLaunched={(context) => {
                setActivePresenceSession({
                  addr: context.server.addr,
                  modeLabel: context.modeLabel,
                  fallbackServer: context.server,
                });
              }}
            />
          </>
        ) : page === "favorites" ? (
          <FavoritesPage
            servers={mergedServers}
            isLoading={serversQuery.isLoading}
            isRefreshing={
              serversQuery.fetchStatus === "fetching" && !serversQuery.isLoading
            }
            error={
              steamApiKey.length === 0
                ? "Set VITE_STEAM_API_KEY to load servers."
                : serversErrorMessage
            }
            onRefresh={() => {
              void serversQuery.refetch();
            }}
            onServerLaunched={(context) => {
              setActivePresenceSession({
                addr: context.server.addr,
                modeLabel: context.modeLabel,
                fallbackServer: context.server,
              });
            }}
          />
        ) : page === "notifications" ? (
          <NotificationsPage />
        ) : (
          <SettingsPage />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
