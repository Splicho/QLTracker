import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  createDefaultServerFilters,
  ServerFilters,
  type ServerFiltersValue,
} from "@/components/server-filters";
import { ServerList } from "@/components/server-list";
import { FavoritesPage } from "@/components/favorites-page";
import { NotificationsPage } from "@/components/notifications-page";
import { SettingsPage } from "@/components/settings-page";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useDiscordPresence } from "@/hooks/use-discord-presence";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRealtimeSnapshots } from "@/hooks/use-realtime-snapshots";
import type { DiscordPresenceServerContext } from "@/lib/discord-presence";
import type { PageId } from "@/lib/navigation";
import {
  fetchSteamServers,
  isQuakeLiveRunning,
  mergeSteamServerSnapshot,
  type SteamServer,
} from "@/lib/steam";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const steamApiKey = import.meta.env.VITE_STEAM_API_KEY?.trim() ?? "";
const SERVER_FILTERS_STORAGE_KEY = "qltracker-server-filters";

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

function parseStoredFilters(rawValue: string): ServerFiltersValue {
  const defaults = createDefaultServerFilters();

  try {
    const parsed = JSON.parse(rawValue) as
      | (Partial<ServerFiltersValue> & {
          hideEmpty?: boolean;
          hideFull?: boolean;
        })
      | null;
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    const ratingRange = Array.isArray(parsed.ratingRange)
      ? parsed.ratingRange
      : null;

    return {
      search:
        typeof parsed.search === "string" ? parsed.search : defaults.search,
      region:
        typeof parsed.region === "string" ? parsed.region : defaults.region,
      visibility:
        parsed.visibility === "all" ||
        parsed.visibility === "public" ||
        parsed.visibility === "private"
          ? parsed.visibility
          : defaults.visibility,
      maps: Array.isArray(parsed.maps)
        ? parsed.maps.filter(
            (value): value is string => typeof value === "string"
          )
        : defaults.maps,
      gameMode:
        typeof parsed.gameMode === "string"
          ? parsed.gameMode
          : defaults.gameMode,
      ratingSystem:
        parsed.ratingSystem === "qelo" || parsed.ratingSystem === "trueskill"
          ? parsed.ratingSystem
          : defaults.ratingSystem,
      ratingRange: [
        typeof ratingRange?.[0] === "number"
          ? ratingRange[0]
          : defaults.ratingRange[0],
        typeof ratingRange?.[1] === "number"
          ? ratingRange[1]
          : defaults.ratingRange[1],
      ],
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter(
            (value): value is string => typeof value === "string"
          )
        : defaults.tags,
      showEmpty:
        typeof parsed.showEmpty === "boolean"
          ? parsed.showEmpty
          : defaults.showEmpty,
      showFull:
        typeof parsed.showFull === "boolean"
          ? parsed.showFull
          : typeof parsed.hideEmpty === "boolean"
            ? parsed.hideEmpty
            : defaults.showFull,
      showFavorites:
        typeof parsed.showFavorites === "boolean"
          ? parsed.showFavorites
          : defaults.showFavorites,
    };
  } catch {
    return defaults;
  }
}

function serializeFilters(filters: ServerFiltersValue) {
  return JSON.stringify(filters);
}

export function App() {
  const [page, setPage] = useState<PageId>("server-list");
  const [activePresenceSession, setActivePresenceSession] = useState<{
    addr: string;
    modeLabel: string | null;
    fallbackServer: SteamServer;
  } | null>(null);
  const { settings } = useAppSettings();
  const [rawFilters, setRawFilters] = useLocalStorage(
    SERVER_FILTERS_STORAGE_KEY,
    serializeFilters(createDefaultServerFilters())
  );
  const filters = useMemo(() => parseStoredFilters(rawFilters), [rawFilters]);
  const serversQuery = useQuery({
    queryKey: ["steam", "servers"],
    queryFn: () => fetchSteamServers(steamApiKey),
    enabled: steamApiKey.length > 0,
    staleTime: 30_000,
    refetchInterval: activePresenceSession ? 15_000 : 60_000,
  });
  const { snapshotsByAddr } = useRealtimeSnapshots(serversQuery.data ?? []);
  const mergedServers = useMemo(
    () =>
      (serversQuery.data ?? []).map((server) => {
        const snapshot = snapshotsByAddr[server.addr];
        return snapshot ? mergeSteamServerSnapshot(server, snapshot) : server;
      }),
    [serversQuery.data, snapshotsByAddr]
  );
  const serversErrorMessage = getQueryErrorMessage(serversQuery.error);
  const activePresenceServer =
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

  useDiscordPresence({
    enabled: settings.discordPresenceEnabled,
    showServerDetails: settings.discordPresenceShowServerDetails,
    page,
    activeServer: activePresenceServer,
  });

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
        <AppSidebar page={page} onNavigate={handleNavigate} />
      </div>
      <SidebarInset className="md:m-0! md:ml-0! md:!rounded-none md:shadow-none">
        <Header page={page} />
        {page === "server-list" ? (
          <>
            <ServerFilters
              value={filters}
              onChange={(next) => {
                setRawFilters(serializeFilters(next));
              }}
              onReset={() => {
                setRawFilters(serializeFilters(createDefaultServerFilters()));
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
