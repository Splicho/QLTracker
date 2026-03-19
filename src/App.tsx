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
import { ReleaseNotesDialog } from "@/components/release-notes-dialog";
import { SettingsPage } from "@/components/pages/settings-page";
import { WatchlistPage } from "@/components/pages/watchlist-page";
import { useAppSettings } from "@/hooks/use-app-settings";
import { useAppTray } from "@/hooks/use-app-tray";
import { useDesktopAlerts } from "@/hooks/use-desktop-alerts";
import { useDiscordPresence } from "@/hooks/use-discord-presence";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useRealtimePlayerPresence } from "@/hooks/use-realtime-player-presence";
import { useRealtimeSnapshots } from "@/hooks/use-realtime-snapshots";
import { useServerInteractions } from "@/hooks/use-server-interactions";
import { useTrackedPlayerIdentitySync } from "@/hooks/use-tracked-player-identity-sync";
import type { DiscordPresenceServerContext } from "@/lib/discord-presence";
import { registerGlobalErrorLogging } from "@/lib/error-log";
import type { PageId } from "@/lib/navigation";
import { isRealtimeEnabled } from "@/lib/realtime";
import {
  fetchGitHubReleaseNotes,
  LAST_SEEN_RELEASE_NOTES_VERSION_STORAGE_KEY,
  parsePendingReleaseNotes,
  parseReleaseNotesVersion,
  PENDING_RELEASE_NOTES_STORAGE_KEY,
  RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY,
  serializePendingReleaseNotes,
  shouldShowPendingReleaseNotes,
} from "@/lib/release-notes";
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
import {
  createFallbackServerFromPresence,
  getGameModeLabel,
} from "@/lib/server-utils";
import {
  parseSettingsSection,
  SETTINGS_SECTION_STORAGE_KEY,
} from "@/lib/settings-navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

const steamApiKey = import.meta.env.VITE_STEAM_API_KEY?.trim() ?? "";

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

export function App() {
  const { t } = useTranslation();
  const appVersion = import.meta.env.PACKAGE_VERSION ?? "0.1.0";
  const [page, setPage] = useState<PageId>("server-list");
  const [lastNonSettingsPage, setLastNonSettingsPage] =
    useState<Exclude<PageId, "settings">>("server-list");
  const [activePresenceSession, setActivePresenceSession] = useState<{
    addr: string;
    modeLabel: string | null;
    fallbackServer: SteamServer;
  } | null>(null);
  const [isTrackedQuakeLiveRunning, setIsTrackedQuakeLiveRunning] = useState<
    boolean | null
  >(null);
  const { settings, updateSettings } = useAppSettings();
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
  const [rawSettingsSection, setRawSettingsSection] = useLocalStorage(
    SETTINGS_SECTION_STORAGE_KEY,
    "general"
  );
  const [pendingReleaseNotes, setPendingReleaseNotes] = useState(() =>
    parsePendingReleaseNotes(
      localStorage.getItem(PENDING_RELEASE_NOTES_STORAGE_KEY) ?? ""
    )
  );
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const settingsSection = parseSettingsSection(rawSettingsSection);
  const [filters, setFilters] = useState(() =>
    parseStoredServerFilters(rawFilters)
  );
  useEffect(() => registerGlobalErrorLogging(), []);
  useTrackedPlayerIdentitySync();
  useEffect(() => {
    let cancelled = false;

    const lastSeenVersion = parseReleaseNotesVersion(
      localStorage.getItem(LAST_SEEN_RELEASE_NOTES_VERSION_STORAGE_KEY)
    );
    const recoveryVersion = parseReleaseNotesVersion(
      localStorage.getItem(RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY)
    );
    const pending = parsePendingReleaseNotes(
      localStorage.getItem(PENDING_RELEASE_NOTES_STORAGE_KEY) ?? ""
    );

    if (pending && pending.version !== appVersion) {
      localStorage.removeItem(PENDING_RELEASE_NOTES_STORAGE_KEY);
      setPendingReleaseNotes(null);
    } else {
      setPendingReleaseNotes(pending);

      if (shouldShowPendingReleaseNotes(pending, appVersion, lastSeenVersion)) {
        setReleaseNotesOpen(true);
        return () => {
          cancelled = true;
        };
      }
    }

    if (recoveryVersion && recoveryVersion !== appVersion) {
      localStorage.removeItem(RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY);
    }

    if (lastSeenVersion === appVersion) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const recoveredReleaseNotes = await fetchGitHubReleaseNotes(appVersion);
      if (!recoveredReleaseNotes || cancelled) {
        return;
      }

      localStorage.setItem(
        PENDING_RELEASE_NOTES_STORAGE_KEY,
        serializePendingReleaseNotes(recoveredReleaseNotes)
      );
      setPendingReleaseNotes(recoveredReleaseNotes);
      setReleaseNotesOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [appVersion]);
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
  useAppTray({
    settings,
    onRefresh: () => {
      void serversQuery.refetch();
    },
    updateSettings,
  });
  useDesktopAlerts({
    servers: mergedServers,
    settings,
  });
  const serversErrorMessage = getQueryErrorMessage(serversQuery.error);
  const handleServerLaunched = (context: DiscordPresenceServerContext) => {
    setActivePresenceSession({
      addr: context.server.addr,
      modeLabel: context.modeLabel,
      fallbackServer: context.server,
    });
  };
  const serverInteractions = useServerInteractions({
    onServerLaunched: handleServerLaunched,
  });
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
        ) ?? createFallbackServerFromPresence(trackedPlayerPresence);

      return {
        server: liveServer,
        modeLabel: getGameModeLabel(trackedPlayerPresence.gameMode, t),
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
    if (nextPage !== "settings") {
      setLastNonSettingsPage(nextPage);
    }

    setPage(nextPage);
    setActivePresenceSession(null);
  };

  const handleReleaseNotesOpenChange = (open: boolean) => {
    setReleaseNotesOpen(open);
    if (open || !pendingReleaseNotes || pendingReleaseNotes.version !== appVersion) {
      return;
    }

    localStorage.setItem(
      LAST_SEEN_RELEASE_NOTES_VERSION_STORAGE_KEY,
      appVersion
    );
    localStorage.removeItem(PENDING_RELEASE_NOTES_STORAGE_KEY);
    localStorage.removeItem(RELEASE_NOTES_RECOVERY_VERSION_STORAGE_KEY);
    setPendingReleaseNotes(null);
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
          onExitSettings={() => handleNavigate(lastNonSettingsPage)}
          onSettingsSectionChange={setRawSettingsSection}
          settingsSection={settingsSection}
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
              onOpenServer={serverInteractions.openServerDetails}
              onJoinServer={serverInteractions.requestJoin}
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
            onOpenServer={serverInteractions.openServerDetails}
            onJoinServer={serverInteractions.requestJoin}
          />
        ) : page === "watchlist" ? (
          <WatchlistPage
            servers={mergedServers}
            onOpenServer={serverInteractions.openServerDetails}
            onJoinServer={serverInteractions.requestJoin}
          />
        ) : (
          <SettingsPage section={settingsSection} />
        )}
      </SidebarInset>
      {serverInteractions.overlays}
      <ReleaseNotesDialog
        open={releaseNotesOpen}
        releaseNotes={pendingReleaseNotes}
        onOpenChange={handleReleaseNotesOpenChange}
      />
    </SidebarProvider>
  );
}
