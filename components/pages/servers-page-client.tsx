"use client";

import { useMemo } from "react";
import { ServerFilters } from "@/components/server/server-filters";
import { ServerList } from "@/components/server/server-list";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useLiveServers } from "@/hooks/use-live-servers";
import { useServerInteractions } from "@/hooks/use-server-interactions";
import {
  SERVER_FILTERS_STORAGE_KEY,
  parseStoredServerFilters,
  serializeServerFilters,
} from "@/lib/server-filters-storage";
import { createDefaultServerFilters } from "@/lib/server-filters";
import type { SteamServer } from "@/lib/steam";

export function ServersPageClient({
  initialServers,
}: {
  initialServers: SteamServer[];
}) {
  const { error, isLoading, isRefreshing, refetch, servers } =
    useLiveServers(initialServers);
  const interactions = useServerInteractions({});
  const [rawFilters, setRawFilters] = useLocalStorage(
    SERVER_FILTERS_STORAGE_KEY,
    serializeServerFilters(createDefaultServerFilters())
  );
  const filters = useMemo(() => parseStoredServerFilters(rawFilters), [rawFilters]);

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ServerFilters
          value={filters}
          onChange={(next) => setRawFilters(serializeServerFilters(next))}
          onReset={() =>
            setRawFilters(serializeServerFilters(createDefaultServerFilters()))
          }
        />
        <div className="min-h-0 flex-1">
          <ServerList
            servers={servers}
            filters={filters}
            isLoading={isLoading}
            isRefreshing={isRefreshing}
            onRefresh={refetch}
            error={error}
            onOpenServer={interactions.openServerDetails}
            onJoinServer={interactions.requestJoin}
          />
        </div>
      </section>
      {interactions.overlays}
    </>
  );
}
