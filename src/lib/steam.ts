import { invoke } from "@tauri-apps/api/core";
import type { ServerCountryLocation } from "@/lib/countries";

const steamAppId = import.meta.env.VITE_STEAM_APP_ID?.trim() || "282440";
const realtimeUrl = import.meta.env.VITE_REALTIME_URL?.trim() || "";
const qlstatsApiUrl =
  import.meta.env.VITE_QLSTATS_API_URL?.trim() || "https://qlstats.net/api";
const trueskillUrlTemplate =
  import.meta.env.VITE_TRUESKILL_URL_TEMPLATE?.trim() ||
  "http://qlrelax.freemyip.com/elo/bn/%s";

export type SteamServer = {
  addr: string;
  steamid: string | null;
  name: string;
  map: string;
  game_directory: string;
  game_description: string;
  app_id: number;
  players: number;
  max_players: number;
  bots: number;
  ping_ms: number | null;
  region: number | null;
  version: string | null;
  keywords: string | null;
  connect_url: string;
  players_info: Array<{
    name: string;
    score: number;
    duration_seconds: number;
  }>;
};

export type RealtimeServerSnapshot = {
  addr: string;
  steamid?: string | null;
  avgQelo?: number | null;
  avgTrueskill?: number | null;
  countryCode?: string | null;
  countryName?: string | null;
  ip?: string | null;
  name: string;
  map: string;
  appId?: number;
  bots?: number;
  connectUrl?: string;
  gameDescription?: string;
  gameDirectory?: string;
  gameMode?: string | null;
  keywords?: string | null;
  maxPlayers: number;
  pingMs?: number | null;
  players: number;
  playersInfo: Array<{
    name: string;
    score: number;
    durationSeconds: number;
    qelo?: number | null;
    steamId?: string | null;
    team?: number | null;
    trueskill?: number | null;
  }>;
  region?: number | null;
  requiresPassword?: boolean | null;
  updatedAt?: string;
  version?: string | null;
};

export function mergeSteamServerSnapshot(
  server: SteamServer,
  snapshot: RealtimeServerSnapshot
): SteamServer {
  return {
    ...server,
    steamid: snapshot.steamid ?? server.steamid,
    name: snapshot.name || server.name,
    map: snapshot.map || server.map,
    game_directory: snapshot.gameDirectory || server.game_directory,
    game_description: snapshot.gameDescription || server.game_description,
    app_id: snapshot.appId ?? server.app_id,
    players: snapshot.players,
    max_players: snapshot.maxPlayers,
    bots: snapshot.bots ?? server.bots,
    ping_ms: snapshot.pingMs ?? server.ping_ms,
    region: snapshot.region ?? server.region,
    version: snapshot.version ?? server.version,
    keywords: snapshot.keywords ?? server.keywords,
    connect_url: snapshot.connectUrl || server.connect_url,
    players_info: server.players_info,
  };
}

export type ServerPing = {
  addr: string;
  ping_ms: number | null;
  requires_password: boolean | null;
};

export type ServerMode = {
  addr: string;
  game_mode: string | null;
};

export type ServerPlayerRating = {
  name: string;
  steam_id: string | null;
  team: number | null;
  qelo: number | null;
  trueskill: number | null;
};

export type ServerRatingSummary = {
  addr: string;
  average_qelo: number | null;
  average_trueskill: number | null;
};

type RealtimeLookupResponse = {
  ok: boolean;
  snapshots: RealtimeServerSnapshot[];
};

type RealtimeSnapshotResponse = {
  ok: boolean;
  snapshot: RealtimeServerSnapshot | null;
};

function isRealtimeEnabled() {
  return realtimeUrl.length > 0;
}

async function fetchRealtimeLookup(addrs: string[]) {
  const response = await fetch(`${realtimeUrl}/api/servers/lookup`, {
    body: JSON.stringify({ addrs }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Realtime lookup failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as RealtimeLookupResponse;
  return payload.snapshots ?? [];
}

async function fetchRealtimeSnapshot(addr: string) {
  const response = await fetch(
    `${realtimeUrl}/api/servers/${encodeURIComponent(addr)}`
  );

  if (!response.ok) {
    throw new Error(`Realtime snapshot failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as RealtimeSnapshotResponse;
  return payload.snapshot;
}

export async function fetchSteamServers(apiKey: string) {
  return invoke<SteamServer[]>("fetch_quake_live_servers", {
    apiKey,
    search: `\\appid\\${steamAppId}`,
    limit: 500,
  });
}

export async function fetchSteamServerPlayers(addr: string) {
  return invoke<SteamServer["players_info"]>("fetch_server_players", {
    addr,
  });
}

export async function fetchSteamServerCountries(addrs: string[]) {
  if (isRealtimeEnabled()) {
    try {
      const snapshots = await fetchRealtimeLookup(addrs);
      return snapshots.map((snapshot) => ({
        addr: snapshot.addr,
        country_code: snapshot.countryCode ?? null,
        country_name: snapshot.countryName ?? null,
        ip: snapshot.ip ?? snapshot.addr.split(":")[0] ?? snapshot.addr,
      }));
    } catch {
      // Fall back to local Tauri fetch.
    }
  }

  return invoke<ServerCountryLocation[]>("fetch_server_countries", {
    addrs,
  });
}

export async function fetchSteamServerPings(addrs: string[]) {
  return invoke<ServerPing[]>("fetch_server_pings", {
    addrs,
  });
}

export async function fetchServerModes(addrs: string[]) {
  if (isRealtimeEnabled()) {
    try {
      const snapshots = await fetchRealtimeLookup(addrs);
      return snapshots.map((snapshot) => ({
        addr: snapshot.addr,
        game_mode: snapshot.gameMode ?? null,
      }));
    } catch {
      // Fall back to local Tauri fetch.
    }
  }

  return invoke<ServerMode[]>("fetch_server_modes", {
    baseUrl: qlstatsApiUrl,
    addrs,
  });
}

export async function fetchSteamServerPlayerRatings(addr: string) {
  if (isRealtimeEnabled()) {
    try {
      const snapshot = await fetchRealtimeSnapshot(addr);
      if (snapshot) {
        return snapshot.playersInfo.map((player) => ({
          name: player.name,
          qelo: player.qelo ?? null,
          steam_id: player.steamId ?? null,
          team: player.team ?? null,
          trueskill: player.trueskill ?? null,
        }));
      }
    } catch {
      // Fall back to local Tauri fetch.
    }
  }

  return invoke<ServerPlayerRating[]>("fetch_server_player_ratings", {
    qlstatsBaseUrl: qlstatsApiUrl,
    trueskillUrlTemplate,
    addr,
  });
}

export async function fetchSteamServerRatingSummaries(
  addrs: string[],
  ratingKind: "qelo" | "trueskill"
) {
  if (isRealtimeEnabled()) {
    try {
      const snapshots = await fetchRealtimeLookup(addrs);
      return snapshots.map((snapshot) => ({
        addr: snapshot.addr,
        average_qelo: snapshot.avgQelo ?? null,
        average_trueskill: snapshot.avgTrueskill ?? null,
      }));
    } catch {
      // Fall back to local Tauri fetch.
    }
  }

  return invoke<ServerRatingSummary[]>("fetch_server_rating_summaries", {
    qlstatsBaseUrl: qlstatsApiUrl,
    trueskillUrlTemplate,
    addrs,
    ratingKind,
  });
}

export async function isQuakeLiveRunning() {
  return invoke<boolean>("is_quake_live_running");
}
