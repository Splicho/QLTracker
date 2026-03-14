import { invoke } from "@tauri-apps/api/core";
import type { ServerCountryLocation } from "@/lib/countries";

const steamAppId = import.meta.env.VITE_STEAM_APP_ID?.trim() || "282440";
const qlstatsApiUrl = import.meta.env.VITE_QLSTATS_API_URL?.trim() || "https://qlstats.net/api";

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

export type ServerPing = {
  addr: string;
  ping_ms: number | null;
};

export type ServerMode = {
  addr: string;
  game_mode: string | null;
};

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
  return invoke<ServerMode[]>("fetch_server_modes", {
    baseUrl: qlstatsApiUrl,
    addrs,
  });
}
