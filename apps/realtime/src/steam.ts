import { config } from "./config.js";
import { lookupCountry } from "./geolite.js";
import type { ServerSnapshot } from "./types.js";

const steamServerListUrl =
  "https://api.steampowered.com/IGameServersService/GetServerList/v1/";

type SteamServerRecord = {
  addr: string;
  steamid?: string | null;
  name?: string | null;
  map?: string | null;
  gamedir?: string | null;
  appid?: number | null;
  players?: number | null;
  max_players?: number | null;
  bots?: number | null;
  region?: number | null;
  keywords?: string | null;
  gametype?: string | null;
};

type SteamListResponse = {
  response?: {
    servers?: SteamServerRecord[];
  };
};

function mergeKeywords(
  keywords: string | null | undefined,
  gametype: string | null | undefined
) {
  const values = [keywords, gametype]
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return values.length > 0 ? Array.from(new Set(values)).join(",") : null;
}

function normalizeGameMode(keywords: string | null | undefined) {
  const knownModes: Record<string, string> = {
    ca: "ca",
    clanarena: "ca",
    duel: "duel",
    ffa: "ffa",
    freeforall: "ffa",
    tdm: "tdm",
    teamdeathmatch: "tdm",
    ctf: "ctf",
    ad: "ad",
    attackdefend: "ad",
    attackanddefend: "ad",
    dom: "dom",
    domination: "dom",
    ft: "ft",
    freezetag: "ft",
    har: "har",
    harvester: "har",
    race: "race",
    rr: "rr",
    redrover: "rr",
  };
  const parts =
    keywords
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter((part) => part.length > 0) ?? [];

  for (const part of parts) {
    if (part.startsWith("g_")) {
      const normalized = part.replace(/^g_/, "");
      return knownModes[normalized] ?? normalized;
    }

    const compact = part.replace(/[\s_-]+/g, "");
    if (compact in knownModes) {
      return knownModes[compact];
    }
  }

  return null;
}

async function buildSnapshot(server: SteamServerRecord): Promise<ServerSnapshot> {
  const mergedKeywords = mergeKeywords(server.keywords, server.gametype);
  const country = await lookupCountry(server.addr);

  return {
    addr: server.addr,
    countryCode: country.countryCode,
    countryName: country.countryName,
    steamid: server.steamid ?? null,
    ip: country.ip,
    name: server.name ?? "Unknown server",
    map: server.map ?? "unknown",
    appId: server.appid ?? 282440,
    bots: server.bots ?? 0,
    connectUrl: `steam://connect/${server.addr}`,
    gameDescription: "Quake Live",
    gameDirectory: server.gamedir ?? "baseq3",
    gameMode: normalizeGameMode(mergedKeywords),
    keywords: mergedKeywords,
    maxPlayers: server.max_players ?? 16,
    pingMs: null,
    players: server.players ?? 0,
    playersInfo: [],
    region: server.region ?? null,
    requiresPassword: null,
    updatedAt: new Date().toISOString(),
    version: null,
  };
}

export async function fetchSteamSnapshots() {
  if (!config.steamApiKey) {
    return [];
  }

  const url = new URL(steamServerListUrl);
  url.searchParams.set("key", config.steamApiKey);
  url.searchParams.set("filter", `\\appid\\${config.steamAppId}`);
  url.searchParams.set("limit", String(config.steamServerLimit));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Steam API returned HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as SteamListResponse;
  const servers = payload.response?.servers ?? [];

  return Promise.all(servers.map(buildSnapshot));
}
