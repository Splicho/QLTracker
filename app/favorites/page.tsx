"use client";

import { FavoritesPage } from "@/components/pages/favorites-page";
import { useLiveServers } from "@/hooks/use-live-servers";
import { useServerInteractions } from "@/hooks/use-server-interactions";

export default function FavoritesRoutePage() {
  const { error, isLoading, isRefreshing, refetch, servers } = useLiveServers();
  const interactions = useServerInteractions({});

  return (
    <>
      <FavoritesPage
        servers={servers}
        isLoading={isLoading}
        isRefreshing={isRefreshing}
        error={error}
        onRefresh={refetch}
        onOpenServer={interactions.openServerDetails}
        onJoinServer={interactions.requestJoin}
      />
      {interactions.overlays}
    </>
  );
}
