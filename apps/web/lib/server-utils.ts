import type { RealtimePlayerPresence } from "@/lib/realtime"
import type { SteamServer } from "@/lib/steam"

const steamAppId =
  Number(process.env.NEXT_PUBLIC_STEAM_APP_ID?.trim() ?? "282440") || 282440

export const modeLabelKeys: Record<string, string> = {
  ca: "filters.modes.ca",
  duel: "filters.modes.duel",
  ffa: "filters.modes.ffa",
  tdm: "filters.modes.tdm",
  ctf: "filters.modes.ctf",
  ad: "filters.modes.ad",
  dom: "filters.modes.dom",
  ft: "filters.modes.ft",
  har: "filters.modes.har",
  race: "filters.modes.race",
  rr: "filters.modes.rr",
  td: "filters.modes.tdm",
  "1f": "filters.modes.ctf",
}

export function normalizeGameMode(server: Pick<SteamServer, "keywords">) {
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
  }

  const keywordParts =
    server.keywords
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean) ?? []

  for (const part of keywordParts) {
    if (part.startsWith("g_")) {
      const normalized = part.replace(/^g_/, "")
      return knownModes[normalized] ?? normalized
    }

    const compact = part.replace(/[\s_-]+/g, "")
    if (compact in knownModes) {
      return knownModes[compact]
    }
  }

  return null
}

export function getGameModeLabel(
  gameMode: string | null | undefined,
  t: (key: string) => string
) {
  if (!gameMode) {
    return null
  }

  const normalizedMode = gameMode.trim().toLowerCase()
  const key = modeLabelKeys[normalizedMode]

  return key ? t(key) : normalizedMode.toUpperCase()
}

export function buildSteamConnectUrl(serverAddress: string, password?: string) {
  const trimmedPassword = password?.trim()
  return trimmedPassword
    ? `steam://connect/${serverAddress}/${encodeURIComponent(trimmedPassword)}`
    : `steam://connect/${serverAddress}`
}

export function createFallbackServerFromPresence(
  presence: RealtimePlayerPresence
): SteamServer {
  return {
    addr: presence.addr,
    steamid: null,
    name: presence.serverName,
    map: presence.map,
    game_directory: "baseq3",
    game_description: "Quake Live",
    app_id: steamAppId,
    players: presence.players,
    max_players: presence.maxPlayers,
    bots: 0,
    ping_ms: null,
    region: null,
    version: null,
    keywords: null,
    connect_url: `steam://connect/${presence.addr}`,
    players_info: [],
  }
}
