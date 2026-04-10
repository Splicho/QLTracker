import type { Metadata } from "next";
import { LeaderboardsPageClient } from "@/components/pages/leaderboards-page-client";
import { getPickupLeaderboards } from "@/lib/server/pickup";
import { createPageMetadata } from "@/lib/seo";

export const runtime = "nodejs";
export const metadata: Metadata = createPageMetadata({
  title: "Leaderboards",
  path: "/leaderboards",
  description:
    "See the latest QLTracker pickup leaderboard standings, ratings, win rates, and top Quake Live players.",
});

export default async function LeaderboardsRoutePage() {
  const initialData = await getPickupLeaderboards();

  return <LeaderboardsPageClient initialData={initialData} />;
}
