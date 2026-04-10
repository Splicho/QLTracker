import type { Metadata } from "next";
import { ServersPageClient } from "@/components/pages/servers-page-client";
import { createPageMetadata } from "@/lib/seo";
import {
  toSteamServer,
  type RealtimeServerSnapshot,
  type SteamServer,
} from "@/lib/steam";

export const dynamic = "force-dynamic";
export const metadata: Metadata = createPageMetadata({
  title: "Servers",
  path: "/servers",
  description:
    "Browse live Quake Live servers, filter by mode and region, and jump straight into active matches with QLTracker.",
});

async function fetchInitialServers() {
  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "");
  if (!realtimeUrl) {
    return [] satisfies SteamServer[];
  }

  const response = await fetch(`${realtimeUrl}/api/servers`, {
    cache: "no-store",
  });

  if (!response.ok) {
    return [] satisfies SteamServer[];
  }

  const payload = (await response.json()) as {
    ok: boolean;
    snapshots?: RealtimeServerSnapshot[];
  };

  return (payload.snapshots ?? []).map(toSteamServer);
}

export default async function ServersPage() {
  const initialServers = await fetchInitialServers();

  return <ServersPageClient initialServers={initialServers} />;
}
