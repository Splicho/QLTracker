import type { Metadata } from "next";
import { WatchlistPageClient } from "@/components/pages/watchlist-page-client";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Watchlist",
  path: "/watchlist",
  description:
    "Follow tracked Quake Live players with the QLTracker watchlist and see when they are active across live servers.",
});

export default function WatchlistRoutePage() {
  return <WatchlistPageClient />;
}
