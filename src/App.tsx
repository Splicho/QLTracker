import { type CSSProperties, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import {
  createDefaultRatingRange,
  ServerFilters,
  type ServerFiltersValue,
} from "@/components/server-filters";
import { ServerList } from "@/components/server-list";
import { FavoritesPage } from "@/components/favorites-page";
import type { PageId } from "@/lib/navigation";
import { fetchSteamServers } from "@/lib/steam";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
  const [page, setPage] = useState<PageId>("server-list");
  const [filters, setFilters] = useState<ServerFiltersValue>({
    search: "",
    region: "all",
    maps: [],
    gameMode: "all",
    ratingSystem: "qelo",
    ratingRange: createDefaultRatingRange(),
    tags: [],
    hideEmpty: false,
    hideFull: false,
  });
  const serversQuery = useQuery({
    queryKey: ["steam", "servers"],
    queryFn: () => fetchSteamServers(steamApiKey),
    enabled: steamApiKey.length > 0,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const serversErrorMessage = getQueryErrorMessage(serversQuery.error);

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    console.log("[QLTracker] Steam query", {
      enabled: steamApiKey.length > 0,
      status: serversQuery.status,
      fetchStatus: serversQuery.fetchStatus,
      count: serversQuery.data?.length ?? 0,
      error: serversErrorMessage,
      filters,
    });
  }, [
    filters,
    serversQuery.data,
    serversQuery.fetchStatus,
    serversQuery.status,
    serversErrorMessage,
  ]);

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
        <AppSidebar page={page} onNavigate={setPage} />
      </div>
      <SidebarInset className="md:m-0! md:ml-0! md:!rounded-none md:shadow-none">
        <Header page={page} />
        {page === "server-list" ? (
          <>
            <ServerFilters
              value={filters}
              onChange={setFilters}
              onRefresh={() => {
                void serversQuery.refetch();
              }}
              refreshing={serversQuery.fetchStatus === "fetching"}
              onReset={() =>
                setFilters({
                  search: "",
                  region: "all",
                  maps: [],
                  gameMode: "all",
                  ratingSystem: "qelo",
                  ratingRange: createDefaultRatingRange(),
                  tags: [],
                  hideEmpty: false,
                  hideFull: false,
                })
              }
            />
            <ServerList
              servers={serversQuery.data ?? []}
              filters={filters}
              isLoading={serversQuery.isLoading}
              isRefreshing={serversQuery.fetchStatus === "fetching" && !serversQuery.isLoading}
              error={steamApiKey.length === 0 ? "Set VITE_STEAM_API_KEY to load servers." : serversErrorMessage}
            />
          </>
        ) : (
          <FavoritesPage
            servers={serversQuery.data ?? []}
            isLoading={serversQuery.isLoading}
            isRefreshing={serversQuery.fetchStatus === "fetching" && !serversQuery.isLoading}
            error={steamApiKey.length === 0 ? "Set VITE_STEAM_API_KEY to load servers." : serversErrorMessage}
            onRefresh={() => {
              void serversQuery.refetch();
            }}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
