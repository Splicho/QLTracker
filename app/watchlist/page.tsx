"use client";

import { WatchlistPage } from "@/components/pages/watchlist-page";
import { useLiveServers } from "@/hooks/use-live-servers";
import { useServerInteractions } from "@/hooks/use-server-interactions";

export default function WatchlistRoutePage() {
  const { servers } = useLiveServers();
  const interactions = useServerInteractions({});

  return (
    <>
      <WatchlistPage
        servers={servers}
        onOpenServer={interactions.openServerDetails}
        onJoinServer={interactions.requestJoin}
      />
      {interactions.overlays}
    </>
  );
}
