import type { ServerCountryLocation } from "@/lib/countries"

const steamAppId =
  Number(process.env.NEXT_PUBLIC_STEAM_APP_ID?.trim() || "282440") || 282440
const realtimeUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "") || ""
const realtimeApiBasePath = "/api/realtime"

export type SteamServer = {
  addr: string
  avg_qelo?: number | null
  avg_trueskill?: number | null
  steamid: string | null
  country_code?: string | null
  country_name?: string | null
  name: string
  map: string
  game_directory: string
  game_description: string
  game_mode?: string | null
  app_id: number
  ip?: string | null
  players: number
  max_players: number
  bots: number
  ping_ms: number | null
  region: number | null
  requires_password?: boolean | null
  version: string | null
  keywords: string | null
  connect_url: string
  players_info: Array<{
    name: string
    score: number
    duration_seconds: number
  }>
}

export type RealtimeServerSnapshot = {
  addr: string
  steamid?: string | null
  avgQelo?: number | null
  avgTrueskill?: number | null
  countryCode?: string | null
  countryName?: string | null
  ip?: string | null
  name: string
  map: string
  appId?: number
  bots?: number
  connectUrl?: string
  gameDescription?: string
  gameDirectory?: string
  gameMode?: string | null
  keywords?: string | null
  maxPlayers: number
  pingMs?: number | null
  players: number
  playersInfo: Array<{
    name: string
    score: number
    durationSeconds: number
    qelo?: number | null
    steamId?: string | null
    team?: number | null
    trueskill?: number | null
  }>
  region?: number | null
  requiresPassword?: boolean | null
  updatedAt?: string
  version?: string | null
}

function sanitizeServerCounts(players: number, maxPlayers: number, playersInfoCount: number) {
  const safeMaxPlayers = Math.max(
    1,
    Math.min(64, Number.isFinite(maxPlayers) ? Math.trunc(maxPlayers) : 16)
  )
  const safePlayers = Math.max(
    0,
    Math.min(
      safeMaxPlayers,
      playersInfoCount > 0
        ? Math.min(Number.isFinite(players) ? Math.trunc(players) : 0, playersInfoCount)
        : Number.isFinite(players)
          ? Math.trunc(players)
          : 0
    )
  )

  return {
    maxPlayers: safeMaxPlayers,
    players: safePlayers,
  }
}

export function mergeSteamServerSnapshot(
  server: SteamServer,
  snapshot: RealtimeServerSnapshot
): SteamServer {
  const counts = sanitizeServerCounts(
    snapshot.players,
    snapshot.maxPlayers,
    snapshot.playersInfo.length
  )

  return {
    ...server,
    avg_qelo: snapshot.avgQelo ?? server.avg_qelo ?? null,
    avg_trueskill: snapshot.avgTrueskill ?? server.avg_trueskill ?? null,
    steamid: snapshot.steamid ?? server.steamid,
    country_code: snapshot.countryCode ?? server.country_code ?? null,
    country_name: snapshot.countryName ?? server.country_name ?? null,
    name: snapshot.name || server.name,
    map: snapshot.map || server.map,
    game_directory: snapshot.gameDirectory || server.game_directory,
    game_description: snapshot.gameDescription || server.game_description,
    game_mode: snapshot.gameMode ?? server.game_mode ?? null,
    app_id: snapshot.appId ?? server.app_id,
    ip: snapshot.ip ?? server.ip ?? null,
    players: counts.players,
    max_players: counts.maxPlayers,
    bots: snapshot.bots ?? server.bots,
    ping_ms: snapshot.pingMs ?? server.ping_ms,
    region: snapshot.region ?? server.region,
    requires_password:
      snapshot.requiresPassword ?? server.requires_password ?? null,
    version: snapshot.version ?? server.version,
    keywords: snapshot.keywords ?? server.keywords,
    connect_url: snapshot.connectUrl || server.connect_url,
    players_info: server.players_info,
  }
}

export type ServerPing = {
  addr: string
  ping_ms: number | null
  requires_password: boolean | null
}

export type ServerMode = {
  addr: string
  game_mode: string | null
}

export type ServerPlayerRating = {
  name: string
  steam_id: string | null
  team: number | null
  qelo: number | null
  trueskill: number | null
}

export type ServerRatingSummary = {
  addr: string
  average_qelo: number | null
  average_trueskill: number | null
}

type RealtimeLookupResponse = {
  ok: boolean
  snapshots: RealtimeServerSnapshot[]
}

type RealtimeServersResponse = {
  ok: boolean
  snapshots: RealtimeServerSnapshot[]
}

type RealtimeSnapshotResponse = {
  ok: boolean
  snapshot: RealtimeServerSnapshot | null
}

function hasRealtimeTrueskillRatings(snapshot: RealtimeServerSnapshot) {
  return snapshot.playersInfo.some((player) => player.trueskill != null)
}

function requireRealtimeUrl() {
  if (!realtimeUrl) {
    throw new Error("NEXT_PUBLIC_REALTIME_URL is not configured.")
  }

  return realtimeUrl
}

async function fetchRealtimeJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    throw new Error(`Realtime request failed with HTTP ${response.status}.`)
  }

  return (await response.json()) as T
}

async function fetchRealtimeLookup(addrs: string[]) {
  requireRealtimeUrl()
  const payload = await fetchRealtimeJson<RealtimeLookupResponse>(
    `${realtimeApiBasePath}/servers/lookup`,
    {
      body: JSON.stringify({ addrs }),
      method: "POST",
    }
  )

  return payload.snapshots ?? []
}

async function fetchRealtimeSnapshot(addr: string) {
  requireRealtimeUrl()
  const payload = await fetchRealtimeJson<RealtimeSnapshotResponse>(
    `${realtimeApiBasePath}/servers/${encodeURIComponent(addr)}`
  )

  return payload.snapshot
}

export function toSteamServer(snapshot: RealtimeServerSnapshot): SteamServer {
  const counts = sanitizeServerCounts(
    snapshot.players,
    snapshot.maxPlayers,
    snapshot.playersInfo.length
  )

  return {
    addr: snapshot.addr,
    avg_qelo: snapshot.avgQelo ?? null,
    avg_trueskill: snapshot.avgTrueskill ?? null,
    steamid: snapshot.steamid ?? null,
    country_code: snapshot.countryCode ?? null,
    country_name: snapshot.countryName ?? null,
    name: snapshot.name,
    map: snapshot.map,
    game_directory: snapshot.gameDirectory ?? "baseq3",
    game_description: snapshot.gameDescription ?? "Quake Live",
    game_mode: snapshot.gameMode ?? null,
    app_id: snapshot.appId ?? steamAppId,
    ip: snapshot.ip ?? null,
    players: counts.players,
    max_players: counts.maxPlayers,
    bots: snapshot.bots ?? 0,
    ping_ms: snapshot.pingMs ?? null,
    region: snapshot.region ?? null,
    requires_password: snapshot.requiresPassword ?? null,
    version: snapshot.version ?? null,
    keywords: snapshot.keywords ?? null,
    connect_url: snapshot.connectUrl ?? `steam://connect/${snapshot.addr}`,
    players_info: snapshot.playersInfo.map((player) => ({
      duration_seconds: player.durationSeconds,
      name: player.name,
      score: player.score,
    })),
  }
}

export async function fetchSteamServers() {
  requireRealtimeUrl()
  const payload = await fetchRealtimeJson<RealtimeServersResponse>(
    `${realtimeApiBasePath}/servers`
  )

  return (payload.snapshots ?? []).map(toSteamServer)
}

export async function fetchSteamServerPlayers(addr: string) {
  const snapshot = await fetchRealtimeSnapshot(addr)
  if (!snapshot) {
    return []
  }

  return snapshot.playersInfo.map((player) => ({
    duration_seconds: player.durationSeconds,
    name: player.name,
    score: player.score,
  }))
}

export async function fetchSteamServerCountries(addrs: string[]) {
  if (addrs.length === 0) {
    return [] satisfies ServerCountryLocation[]
  }

  const snapshots = await fetchRealtimeLookup(addrs)
  return snapshots.map((snapshot) => ({
    addr: snapshot.addr,
    country_code: snapshot.countryCode ?? null,
    country_name: snapshot.countryName ?? null,
    ip: snapshot.ip ?? snapshot.addr.split(":")[0] ?? snapshot.addr,
  }))
}

export async function fetchSteamServerPings(addrs: string[]) {
  if (addrs.length === 0) {
    return [] satisfies ServerPing[]
  }

  const snapshots = await fetchRealtimeLookup(addrs)
  return snapshots.map((snapshot) => ({
    addr: snapshot.addr,
    ping_ms: snapshot.pingMs ?? null,
    requires_password: snapshot.requiresPassword ?? null,
  }))
}

export async function fetchServerModes(addrs: string[]) {
  if (addrs.length === 0) {
    return [] satisfies ServerMode[]
  }

  const snapshots = await fetchRealtimeLookup(addrs)
  return snapshots.map((snapshot) => ({
    addr: snapshot.addr,
    game_mode: snapshot.gameMode ?? null,
  }))
}

export async function fetchSteamServerPlayerRatings(addr: string) {
  const snapshot = await fetchRealtimeSnapshot(addr)
  if (!snapshot) {
    return [] satisfies ServerPlayerRating[]
  }

  if (snapshot.players > 0 && !hasRealtimeTrueskillRatings(snapshot)) {
    return snapshot.playersInfo.map((player) => ({
      name: player.name,
      qelo: player.qelo ?? null,
      steam_id: player.steamId ?? null,
      team: player.team ?? null,
      trueskill: player.trueskill ?? null,
    }))
  }

  return snapshot.playersInfo.map((player) => ({
    name: player.name,
    qelo: player.qelo ?? null,
    steam_id: player.steamId ?? null,
    team: player.team ?? null,
    trueskill: player.trueskill ?? null,
  }))
}

export async function fetchSteamServerRatingSummaries(addrs: string[]) {
  if (addrs.length === 0) {
    return [] satisfies ServerRatingSummary[]
  }

  const snapshots = await fetchRealtimeLookup(addrs)
  return snapshots.map((snapshot) => ({
    addr: snapshot.addr,
    average_qelo: snapshot.avgQelo ?? null,
    average_trueskill: snapshot.avgTrueskill ?? null,
  }))
}

export async function isQuakeLiveRunning() {
  return false
}
