import type {
  PickupMatchChatEvent,
  PickupKillEvent,
  PickupMapPool,
  PickupMatch,
  PickupMatchEventRaw,
  PickupMatchPlayer,
  PickupMatchStatsSummary,
  PickupPlayer,
  PickupPlayerSeasonRating,
  PickupPlayerWeaponStat,
  PickupQueue,
  PickupSettings,
  PickupSeason,
} from "@prisma/client"

import { getNotificationEnv } from "@/lib/server/env"
import { routeError } from "@/lib/server/errors"
import { getPrisma } from "@/lib/server/prisma"
import { isPickupAdminSteamId } from "@/lib/server/pickup-auth"
import type { PickupMatchState, PickupProfileMatch } from "@/lib/pickup"

export const DEFAULT_PICKUP_QUEUE_SLUG = "4v4-ca"

const DEFAULT_PICKUP_QUEUE = {
  slug: DEFAULT_PICKUP_QUEUE_SLUG,
  name: "4v4 CA",
  description: "Seasonal 4v4 Clan Arena pickup queue.",
  teamSize: 4,
  playerCount: 8,
  enabled: true,
}

const DEFAULT_PICKUP_SETTINGS = {
  id: "default",
  readyCheckDurationSeconds: 30,
  vetoTurnDurationSeconds: 20,
  provisionApiUrl: null,
  provisionAuthToken: null,
  callbackSecret: null,
  r2AccountId: null,
  r2BucketName: null,
  r2PublicBaseUrl: null,
  r2AccessKeyId: null,
  r2SecretAccessKey: null,
}

export type PickupPlayerDto = {
  avatarUrl: string | null
  coverImageUrl: string | null
  countryCode: string | null
  customAvatarUrl: string | null
  id: string
  isAdmin: boolean
  personaName: string
  profileUrl: string | null
  steamId: string
  steamAvatarUrl: string | null
}

export type PickupQueueDto = {
  description: string | null
  enabled: boolean
  id: string
  name: string
  playerCount: number
  slug: string
  teamSize: number
}

export type PickupSettingsDto = {
  hasCallbackSecret: boolean
  hasProvisionAuthToken: boolean
  hasR2AccessKeyId: boolean
  hasR2SecretAccessKey: boolean
  provisionApiUrl: string | null
  readyCheckDurationSeconds: number
  r2AccountId: string | null
  r2BucketName: string | null
  r2PublicBaseUrl: string | null
  vetoTurnDurationSeconds: number
}

export type PickupSeasonDto = {
  durationPreset: PickupSeason["durationPreset"]
  endsAt: string
  id: string
  name: string
  startsAt: string
  status: PickupSeason["status"]
}

export type PickupMapPoolDto = {
  active: boolean
  id: string
  label: string
  mapKey: string
  sortOrder: number
}

export type PickupRatingDto = {
  displayRating: number
  gamesPlayed: number
  losses: number
  mu: number
  sigma: number
  wins: number
}

export type PickupActiveRatingDto = PickupRatingDto & {
  queueId: string
  queueName: string
  queueSlug: string
  seasonId: string
  seasonName: string
}

export type PickupMeDto = {
  player: PickupPlayerDto
  rating: PickupRatingDto | null
  ratings: PickupActiveRatingDto[]
}

export type PickupLeaderboardEntryDto = {
  gamesPlayed: number
  losses: number
  player: PickupPlayerDto
  rank: number
  rating: number
  winRate: number | null
  wins: number
}

export type PickupLeaderboardQueueDto = {
  entries: PickupLeaderboardEntryDto[]
  queue: PickupQueueDto
  season: PickupSeasonDto
}

export type PickupLeaderboardsDto = {
  queues: PickupLeaderboardQueueDto[]
}

export type PickupProfileStatsDto = {
  combat: {
    deaths: number
    kd: number | null
    kills: number
  }
  losses: number
  totalMatches: number
  winRate: number | null
  wins: number
}

export type PickupProfileMatchDto = {
  completedAt: string | null
  finalMapKey: string | null
  finalScore: string | null
  id: string
  queue: PickupQueueDto
  ratingAfter: number | null
  ratingBefore: number
  ratingDelta: number | null
  result: "win" | "loss" | null
  season: PickupSeasonDto
  team: PickupMatchPlayer["team"]
  winnerTeam: PickupMatch["winnerTeam"]
}

export type PickupPlayerProfileDto = {
  player: PickupPlayerDto
  ratings: PickupActiveRatingDto[]
  recentMatches: PickupProfileMatchDto[]
  stats: PickupProfileStatsDto
}

export type PickupMatchWeaponStatDto = {
  accuracy: number | null
  damage: number | null
  deaths: number | null
  hits: number | null
  kills: number | null
  shots: number | null
  timeSeconds: number | null
  weapon: string
}

export type PickupMatchPlayerStatsDto = {
  accuracy: number | null
  damageGiven: number | null
  damageTaken: number | null
  deaths: number | null
  displayAfter: number | null
  displayBefore: number
  kills: number | null
  medals: Record<string, unknown> | null
  ping: number | null
  player: PickupPlayerDto
  result: "win" | "loss" | null
  score: number | null
  team: PickupMatchPlayer["team"]
  timeSeconds: number | null
  weaponStats: PickupMatchWeaponStatDto[]
}

export type PickupMatchKillEventDto = {
  eventIndex: number
  killerName: string | null
  killerPlayerId: string | null
  mod: string | null
  occurredAt: string | null
  suicide: boolean
  teamKill: boolean
  victimName: string | null
  victimPlayerId: string | null
  weapon: string | null
}

export type PickupMatchDetailDto = {
  chat: Array<{
    channel: string
    createdAt: string
    id: string
    message: string
    personaName: string
    playerId: string | null
    sentAt: string
    steamId: string | null
  }>
  kills: PickupMatchKillEventDto[]
  match: {
    completedAt: string | null
    finalMapKey: string | null
    finalScore: string | null
    id: string
    liveStartedAt: string | null
    queue: PickupQueueDto
    season: PickupSeasonDto
    status: PickupMatch["status"]
    winnerTeam: PickupMatch["winnerTeam"]
  }
  rawEvents: Array<{
    createdAt: string
    eventAt: string | null
    eventIndex: number
    eventType: string
    payload: Record<string, unknown>
    source: string
  }>
  statsSummary: {
    blueRounds: number | null
    endedAt: string | null
    factory: string | null
    gameType: string | null
    mapKey: string | null
    matchDurationSeconds: number | null
    redRounds: number | null
    roundsPlayed: number | null
    startedAt: string | null
  } | null
  teams: {
    left: PickupMatchPlayerStatsDto[]
    right: PickupMatchPlayerStatsDto[]
  }
}

export type PickupLandingDataDto = {
  liveMatches: PickupMatchState[]
  recentMatches: PickupProfileMatch[]
}

export type PickupAdminQueueOverviewDto = {
  activeSeason: PickupSeasonDto | null
  maps: PickupMapPoolDto[]
  queue: PickupQueueDto
  seasons: PickupSeasonDto[]
}

export type PickupAdminOverviewDto = {
  queues: PickupAdminQueueOverviewDto[]
  viewer: PickupPlayerDto
}

export type PickupAdminSettingsDto = {
  settings: PickupSettingsDto
  viewer: PickupPlayerDto
}

function getPickupAvatarUrl(player: PickupPlayer) {
  return player.customAvatarUrl ?? player.avatarUrl ?? null
}

function getPickupWinRate(wins: number, totalMatches: number) {
  return totalMatches > 0
    ? Number(((wins / totalMatches) * 100).toFixed(1))
    : null
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function buildSteamReturnUrl(oauthState: string) {
  const env = getNotificationEnv()
  return `${env.PUBLIC_BASE_URL.replace(/\/$/, "")}/auth/steam/callback?pickup_state=${encodeURIComponent(oauthState)}`
}

export function buildPickupSteamAuthorizeUrl(oauthState: string) {
  const env = getNotificationEnv()
  const url = new URL("https://steamcommunity.com/openid/login")
  const returnTo = buildSteamReturnUrl(oauthState)

  url.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0")
  url.searchParams.set("openid.mode", "checkid_setup")
  url.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select"
  )
  url.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select"
  )
  url.searchParams.set("openid.return_to", returnTo)
  url.searchParams.set("openid.realm", env.PUBLIC_BASE_URL.replace(/\/$/, ""))

  return url.toString()
}

export async function validatePickupSteamCallback(url: URL) {
  const params = new URLSearchParams(url.searchParams)
  const claimedId = params.get("openid.claimed_id")
  const signedParams = params.get("openid.signed")

  if (!claimedId || !signedParams) {
    routeError(400, "Steam did not return a valid identity.")
  }

  params.set("openid.mode", "check_authentication")

  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  })

  if (!response.ok) {
    throw new Error(
      `Steam OpenID validation failed with HTTP ${response.status}.`
    )
  }

  const payload = await response.text()
  if (!payload.includes("is_valid:true")) {
    routeError(401, "Steam identity could not be verified.")
  }

  return extractSteamIdFromClaimedId(claimedId)
}

function extractSteamIdFromClaimedId(claimedId: string) {
  const idMatch = claimedId.match(/\/openid\/id\/(\d+)$/)
  if (!idMatch) {
    routeError(400, "Steam did not return a valid SteamID.")
  }

  return idMatch[1]
}

export async function fetchSteamProfile(steamId: string) {
  const env = getNotificationEnv()
  const url = new URL(
    "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/"
  )

  url.searchParams.set("key", env.STEAM_API_KEY)
  url.searchParams.set("steamids", steamId)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Steam profile lookup failed with HTTP ${response.status}.`)
  }

  const payload = (await response.json()) as {
    response?: {
      players?: Array<{
        avatarfull?: string
        personaname?: string
        profileurl?: string
        steamid?: string
      }>
    }
  }
  const player = payload.response?.players?.[0]

  if (!player?.steamid) {
    routeError(404, "Steam profile could not be loaded.")
  }

  return {
    avatarUrl: player.avatarfull ?? null,
    personaName: player.personaname?.trim() || player.steamid,
    profileUrl: player.profileurl ?? null,
    steamId: player.steamid,
  }
}

export async function upsertPickupPlayer(steamId: string) {
  const prisma = getPrisma()
  const profile = await fetchSteamProfile(steamId)

  return prisma.pickupPlayer.upsert({
    where: {
      steamId: profile.steamId,
    },
    update: {
      avatarUrl: profile.avatarUrl,
      lastLoginAt: new Date(),
      personaName: profile.personaName,
      profileUrl: profile.profileUrl,
    },
    create: {
      avatarUrl: profile.avatarUrl,
      lastLoginAt: new Date(),
      personaName: profile.personaName,
      profileUrl: profile.profileUrl,
      steamId: profile.steamId,
    },
  })
}

export async function refreshPickupPlayerIfStale(
  player: PickupPlayer,
  maxAgeMs: number
) {
  const ageMs = Date.now() - player.updatedAt.getTime()
  if (ageMs < maxAgeMs) {
    return player
  }

  try {
    const profile = await fetchSteamProfile(player.steamId)
    return await getPrisma().pickupPlayer.update({
      where: {
        id: player.id,
      },
      data: {
        avatarUrl: profile.avatarUrl,
        personaName: profile.personaName,
        profileUrl: profile.profileUrl,
      },
    })
  } catch (error) {
    console.error(
      `Failed to refresh pickup Steam profile for ${player.steamId}:`,
      error
    )
    return player
  }
}

export function toPickupPlayerDto(player: PickupPlayer): PickupPlayerDto {
  return {
    avatarUrl: getPickupAvatarUrl(player),
    coverImageUrl: player.customCoverUrl ?? null,
    countryCode: player.countryCode ?? null,
    customAvatarUrl: player.customAvatarUrl ?? null,
    id: player.id,
    isAdmin: isPickupAdminSteamId(player.steamId),
    personaName: player.personaName,
    profileUrl: player.profileUrl ?? null,
    steamId: player.steamId,
    steamAvatarUrl: player.avatarUrl ?? null,
  }
}

export function toPickupQueueDto(queue: PickupQueue): PickupQueueDto {
  return {
    description: queue.description ?? null,
    enabled: queue.enabled,
    id: queue.id,
    name: queue.name,
    playerCount: queue.playerCount,
    slug: queue.slug,
    teamSize: queue.teamSize,
  }
}

export function toPickupSettingsDto(
  settings: PickupSettings
): PickupSettingsDto {
  return {
    hasCallbackSecret: Boolean(settings.callbackSecret),
    hasProvisionAuthToken: Boolean(settings.provisionAuthToken),
    hasR2AccessKeyId: Boolean(settings.r2AccessKeyId),
    hasR2SecretAccessKey: Boolean(settings.r2SecretAccessKey),
    provisionApiUrl: settings.provisionApiUrl ?? null,
    readyCheckDurationSeconds: settings.readyCheckDurationSeconds,
    r2AccountId: settings.r2AccountId ?? null,
    r2BucketName: settings.r2BucketName ?? null,
    r2PublicBaseUrl: settings.r2PublicBaseUrl ?? null,
    vetoTurnDurationSeconds: settings.vetoTurnDurationSeconds,
  }
}

export function toPickupSeasonDto(season: PickupSeason): PickupSeasonDto {
  return {
    durationPreset: season.durationPreset,
    endsAt: season.endsAt.toISOString(),
    id: season.id,
    name: season.name,
    startsAt: season.startsAt.toISOString(),
    status: season.status,
  }
}

export function toPickupMapPoolDto(map: PickupMapPool): PickupMapPoolDto {
  return {
    active: map.active,
    id: map.id,
    label: map.label,
    mapKey: map.mapKey,
    sortOrder: map.sortOrder,
  }
}

export function toPickupRatingDto(
  rating: PickupPlayerSeasonRating
): PickupRatingDto {
  return {
    displayRating: rating.displayRating,
    gamesPlayed: rating.gamesPlayed,
    losses: rating.losses,
    mu: rating.mu,
    sigma: rating.sigma,
    wins: rating.wins,
  }
}

function toPickupMatchWeaponStatDto(
  stat: PickupPlayerWeaponStat
): PickupMatchWeaponStatDto {
  return {
    accuracy: stat.accuracy ?? null,
    damage: stat.damage ?? null,
    deaths: stat.deaths ?? null,
    hits: stat.hits ?? null,
    kills: stat.kills ?? null,
    shots: stat.shots ?? null,
    timeSeconds: stat.timeSeconds ?? null,
    weapon: stat.weapon,
  }
}

function toPickupMatchKillEventDto(
  event: PickupKillEvent
): PickupMatchKillEventDto {
  return {
    eventIndex: event.eventIndex,
    killerName: event.killerName ?? null,
    killerPlayerId: event.killerPlayerId ?? null,
    mod: event.mod ?? null,
    occurredAt: event.occurredAt?.toISOString() ?? null,
    suicide: event.suicide,
    teamKill: event.teamKill,
    victimName: event.victimName ?? null,
    victimPlayerId: event.victimPlayerId ?? null,
    weapon: event.weapon ?? null,
  }
}

function toPickupMatchChatEventDto(event: PickupMatchChatEvent) {
  return {
    channel: event.channel,
    createdAt: event.createdAt.toISOString(),
    id: event.id,
    message: event.message,
    personaName: event.personaName,
    playerId: event.playerId ?? null,
    sentAt: event.sentAt.toISOString(),
    steamId: event.steamId ?? null,
  }
}

function toPickupMatchStatsSummaryDto(summary: PickupMatchStatsSummary | null) {
  if (!summary) {
    return null
  }

  return {
    blueRounds: summary.blueRounds ?? null,
    endedAt: summary.endedAt?.toISOString() ?? null,
    factory: summary.factory ?? null,
    gameType: summary.gameType ?? null,
    mapKey: summary.mapKey ?? null,
    matchDurationSeconds: summary.matchDurationSeconds ?? null,
    redRounds: summary.redRounds ?? null,
    roundsPlayed: summary.roundsPlayed ?? null,
    startedAt: summary.startedAt?.toISOString() ?? null,
  }
}

function toPickupRawEventDto(event: PickupMatchEventRaw) {
  return {
    createdAt: event.createdAt.toISOString(),
    eventAt: event.eventAt?.toISOString() ?? null,
    eventIndex: event.eventIndex,
    eventType: event.eventType,
    payload: (event.payload as Record<string, unknown>) ?? {},
    source: event.source,
  }
}

function parseStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : []
}

function parseVetoTurns(value: unknown): PickupMatchState["veto"]["turns"] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return []
    }

    const turn = entry as Record<string, unknown>
    if (
      typeof turn.captainPlayerId !== "string" ||
      typeof turn.mapKey !== "string" ||
      typeof turn.order !== "number" ||
      (turn.reason !== "captain" && turn.reason !== "timeout")
    ) {
      return []
    }

    return [
      {
        captainPlayerId: turn.captainPlayerId,
        mapKey: turn.mapKey,
        order: turn.order,
        reason: turn.reason,
      },
    ]
  })
}

function toPickupMatchPlayerCard(
  membership: PickupMatchPlayer & { player: PickupPlayer }
): PickupMatchState["teams"]["left"][number] {
  return {
    avatarUrl: getPickupAvatarUrl(membership.player),
    countryCode: membership.player.countryCode ?? null,
    displayAfter: membership.displayAfter ?? null,
    displayBefore: membership.displayBefore,
    id: membership.player.id,
    isCaptain: membership.isCaptain,
    joinedAt: membership.joinedAt.toISOString(),
    personaName: membership.player.personaName,
    profileUrl: membership.player.profileUrl ?? null,
    readyConfirmedAt: membership.readyConfirmedAt?.toISOString() ?? null,
    readyState: membership.readyState,
    steamId: membership.player.steamId,
    team: membership.team,
    won: membership.won ?? null,
  }
}

function toPickupLandingMatchState(
  match: PickupMatch & {
    players: Array<PickupMatchPlayer & { player: PickupPlayer }>
  }
): PickupMatchState {
  const vetoState =
    match.vetoState &&
    typeof match.vetoState === "object" &&
    !Array.isArray(match.vetoState)
      ? (match.vetoState as Record<string, unknown>)
      : null
  const balanceSummary =
    match.balanceSummary &&
    typeof match.balanceSummary === "object" &&
    !Array.isArray(match.balanceSummary)
      ? (match.balanceSummary as PickupMatchState["balanceSummary"])
      : null
  const players = [...match.players].sort(
    (left, right) => left.joinedAt.getTime() - right.joinedAt.getTime()
  )

  return {
    balanceSummary,
    completedAt: match.completedAt?.toISOString() ?? null,
    finalMapKey: match.finalMapKey ?? null,
    finalScore: match.finalScore ?? null,
    id: match.id,
    liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
    queueId: match.queueId,
    readyDeadlineAt: match.readyDeadlineAt?.toISOString() ?? null,
    seasonId: match.seasonId,
    server: {
      countryCode: match.serverLocationCountryCode ?? null,
      countryName: match.serverLocationCountryName ?? null,
      ip: match.serverIp ?? null,
      joinAddress: match.serverJoinAddress ?? null,
      port: match.serverPort ?? null,
      provisionedAt: match.serverProvisionedAt?.toISOString() ?? null,
    },
    status: match.status === "server_ready" ? "server_ready" : "live",
    teams: {
      left: players
        .filter((membership) => membership.team === "left")
        .map(toPickupMatchPlayerCard),
      right: players
        .filter((membership) => membership.team === "right")
        .map(toPickupMatchPlayerCard),
    },
    veto: {
      availableMaps: parseStringArray(vetoState?.availableMaps),
      bannedMaps:
        parseStringArray(vetoState?.bannedMaps).length > 0
          ? parseStringArray(vetoState?.bannedMaps)
          : parseStringArray(match.bannedMapKeys),
      currentCaptainPlayerId:
        (typeof vetoState?.currentCaptainPlayerId === "string"
          ? vetoState.currentCaptainPlayerId
          : null) ??
        match.currentCaptainPlayerId ??
        null,
      deadlineAt: match.vetoDeadlineAt?.toISOString() ?? null,
      turns: parseVetoTurns(vetoState?.turns),
    },
    winnerTeam: match.winnerTeam ?? null,
  }
}

export function toPickupActiveRatingDto(
  rating: PickupPlayerSeasonRating & {
    season: PickupSeason & {
      queue: PickupQueue
    }
  }
): PickupActiveRatingDto {
  return {
    ...toPickupRatingDto(rating),
    queueId: rating.season.queue.id,
    queueName: rating.season.queue.name,
    queueSlug: rating.season.queue.slug,
    seasonId: rating.season.id,
    seasonName: rating.season.name,
  }
}

export function buildPickupAuthResultHtml(success: boolean, message: string) {
  const escapedMessage = escapeHtml(message)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QLTracker Pickup Login</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2.5rem 1.5rem;
        background: linear-gradient(180deg, #050505 0%, #121212 100%);
        color: #fafafa;
        font-family: Geist, Inter, system-ui, sans-serif;
      }
      .panel {
        width: min(28rem, 100%);
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 2rem;
        background: rgba(255,255,255,.05);
        padding: 2.5rem 2rem;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0,0,0,.3);
        backdrop-filter: blur(12px);
      }
      .logo {
        display: block;
        width: 176px;
        height: auto;
        margin: 0 auto 2rem;
      }
      h1 {
        margin: 0 0 .9rem;
        font-size: 1.9rem;
        font-weight: 700;
        letter-spacing: -.02em;
      }
      p {
        margin: 0;
        color: rgba(250,250,250,.72);
        line-height: 1.6;
        font-size: 1rem;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-top: 1.5rem;
        min-width: 8rem;
        border-radius: 999px;
        padding: .5rem 1rem;
        background: ${success ? "rgba(99, 102, 241, 0.18)" : "rgba(239, 68, 68, 0.14)"};
        border: 1px solid ${success ? "rgba(99, 102, 241, 0.32)" : "rgba(239, 68, 68, 0.24)"};
        color: ${success ? "#c7d2fe" : "#fca5a5"};
        font-size: .9rem;
        font-weight: 600;
      }
      .hint {
        margin-top: 1rem;
        color: rgba(250,250,250,.48);
        font-size: .85rem;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <img class="logo" src="/images/logo.png" alt="QLTracker" />
      <h1>${success ? "Steam connected" : "Steam sign-in failed"}</h1>
      <p>${escapedMessage}</p>
      <div class="badge">${success ? "Connected" : "Failed"}</div>
      <p class="hint">You can close this page and return to the launcher.</p>
    </main>
  </body>
</html>`
}

export async function ensurePickupBootstrapData() {
  const prisma = getPrisma()
  await prisma.pickupSettings.upsert({
    where: {
      id: DEFAULT_PICKUP_SETTINGS.id,
    },
    update: {},
    create: DEFAULT_PICKUP_SETTINGS,
  })

  let queue = await prisma.pickupQueue.findUnique({
    where: {
      slug: DEFAULT_PICKUP_QUEUE.slug,
    },
  })

  if (!queue) {
    queue = await prisma.pickupQueue.create({
      data: DEFAULT_PICKUP_QUEUE,
    })
  }

  const seasonCount = await prisma.pickupSeason.count({
    where: {
      queueId: queue.id,
    },
  })

  if (seasonCount === 0) {
    const startsAt = new Date()
    const endsAt = new Date(startsAt)
    endsAt.setMonth(endsAt.getMonth() + 1)

    await prisma.pickupSeason.create({
      data: {
        durationPreset: "one_month",
        endsAt,
        name: "Launch Season",
        queueId: queue.id,
        startsAt,
        status: "active",
      },
    })
  }

  return queue
}

export async function getPickupSettings() {
  await ensurePickupBootstrapData()
  return getPrisma().pickupSettings.findUniqueOrThrow({
    where: {
      id: DEFAULT_PICKUP_SETTINGS.id,
    },
  })
}

export async function getPickupAdminOverview(
  viewer: PickupPlayer
): Promise<PickupAdminOverviewDto> {
  await ensurePickupBootstrapData()
  const prisma = getPrisma()
  const queues = await prisma.pickupQueue.findMany({
    include: {
      mapPool: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      },
      seasons: {
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  })

  return {
    queues: queues.map((queue) => {
      const seasons = queue.seasons.map(toPickupSeasonDto)

      return {
        activeSeason:
          seasons.find((season) => season.status === "active") ?? null,
        maps: queue.mapPool.map(toPickupMapPoolDto),
        queue: toPickupQueueDto(queue),
        seasons,
      }
    }),
    viewer: toPickupPlayerDto(viewer),
  }
}

export async function getPickupAdminSettings(
  viewer: PickupPlayer
): Promise<PickupAdminSettingsDto> {
  const settings = await getPickupSettings()

  return {
    settings: toPickupSettingsDto(settings),
    viewer: toPickupPlayerDto(viewer),
  }
}

export async function getPickupActiveSeason(queueId: string) {
  return getPrisma().pickupSeason.findFirst({
    where: {
      queueId,
      status: "active",
    },
    orderBy: {
      startsAt: "desc",
    },
  })
}

export async function getPreferredPickupPlayerRating(playerId: string) {
  return getPrisma().pickupPlayerSeasonRating.findFirst({
    where: {
      playerId,
      season: {
        status: "active",
      },
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        season: {
          startsAt: "desc",
        },
      },
    ],
  })
}

export async function getPickupPlayerActiveRatings(playerId: string) {
  return getPrisma().pickupPlayerSeasonRating.findMany({
    where: {
      playerId,
      season: {
        status: "active",
      },
    },
    include: {
      season: {
        include: {
          queue: true,
        },
      },
    },
    orderBy: [
      {
        displayRating: "desc",
      },
      {
        updatedAt: "desc",
      },
      {
        season: {
          startsAt: "desc",
        },
      },
    ],
  })
}

export async function getPickupPlayerByIdOrSteamId(playerIdOrSteamId: string) {
  return getPrisma().pickupPlayer.findFirst({
    where: {
      OR: [{ id: playerIdOrSteamId }, { steamId: playerIdOrSteamId }],
    },
  })
}

export async function updatePickupPlayerProfileMedia(
  playerId: string,
  input: {
    countryCode?: string | null
    customAvatarUrl?: string | null
    customCoverUrl?: string | null
  }
) {
  const prisma = getPrisma()
  const existingPlayer = await prisma.pickupPlayer.findUnique({
    where: {
      id: playerId,
    },
  })

  if (!existingPlayer) {
    routeError(404, "Pickup player could not be found.")
  }

  const nextCustomAvatarUrl =
    input.customAvatarUrl === undefined
      ? (existingPlayer.customAvatarUrl ?? null)
      : input.customAvatarUrl
  const nextCustomCoverUrl =
    input.customCoverUrl === undefined
      ? (existingPlayer.customCoverUrl ?? null)
      : input.customCoverUrl
  const nextCountryCode =
    input.countryCode === undefined
      ? (existingPlayer.countryCode ?? null)
      : input.countryCode

  return prisma.pickupPlayer.update({
    where: {
      id: playerId,
    },
    data: {
      countryCode: nextCountryCode,
      customAvatarUrl: nextCustomAvatarUrl,
      customCoverUrl: nextCustomCoverUrl,
    },
  })
}

export async function getPickupPlayerProfile(
  playerIdOrSteamId: string
): Promise<PickupPlayerProfileDto> {
  await ensurePickupBootstrapData()

  const player = await getPickupPlayerByIdOrSteamId(playerIdOrSteamId)
  if (!player) {
    routeError(404, "Pickup player could not be found.")
  }

  const prisma = getPrisma()
  const [ratings, totalMatches, wins, losses, combatTotals, recentMatches] =
    await Promise.all([
      getPickupPlayerActiveRatings(player.id),
      prisma.pickupMatchPlayer.count({
        where: {
          playerId: player.id,
          match: {
            status: "completed",
          },
        },
      }),
      prisma.pickupMatchPlayer.count({
        where: {
          playerId: player.id,
          won: true,
          match: {
            status: "completed",
          },
        },
      }),
      prisma.pickupMatchPlayer.count({
        where: {
          playerId: player.id,
          won: false,
          match: {
            status: "completed",
          },
        },
      }),
      prisma.pickupPlayerMatchStat.aggregate({
        _sum: {
          deaths: true,
          kills: true,
        },
        where: {
          playerId: player.id,
          match: {
            status: "completed",
          },
        },
      }),
      prisma.pickupMatchPlayer.findMany({
        where: {
          playerId: player.id,
          match: {
            status: "completed",
          },
        },
        include: {
          match: {
            include: {
              queue: true,
              season: true,
            },
          },
        },
        orderBy: [
          {
            match: {
              completedAt: "desc",
            },
          },
          {
            joinedAt: "desc",
          },
        ],
        take: 20,
      }),
    ])

  return {
    player: toPickupPlayerDto(player),
    ratings: ratings.map(toPickupActiveRatingDto),
    recentMatches: recentMatches.map((membership) => ({
      completedAt: membership.match.completedAt?.toISOString() ?? null,
      finalMapKey: membership.match.finalMapKey ?? null,
      finalScore: membership.match.finalScore ?? null,
      id: membership.match.id,
      queue: toPickupQueueDto(membership.match.queue),
      ratingAfter: membership.displayAfter ?? null,
      ratingBefore: membership.displayBefore,
      ratingDelta:
        membership.displayAfter != null
          ? membership.displayAfter - membership.displayBefore
          : null,
      result:
        membership.won === true
          ? "win"
          : membership.won === false
            ? "loss"
            : null,
      season: toPickupSeasonDto(membership.match.season),
      team: membership.team,
      winnerTeam: membership.match.winnerTeam ?? null,
    })),
    stats: {
      combat: {
        deaths: combatTotals._sum.deaths ?? 0,
        kd:
          (combatTotals._sum.deaths ?? 0) > 0
            ? Number(
                (
                  (combatTotals._sum.kills ?? 0) /
                  (combatTotals._sum.deaths ?? 0)
                ).toFixed(2)
              )
            : (combatTotals._sum.kills ?? 0) > 0
              ? Number((combatTotals._sum.kills ?? 0).toFixed(2))
              : null,
        kills: combatTotals._sum.kills ?? 0,
      },
      losses,
      totalMatches,
      winRate: getPickupWinRate(wins, totalMatches),
      wins,
    },
  }
}

export async function getPickupMatchDetail(
  matchId: string
): Promise<PickupMatchDetailDto> {
  await ensurePickupBootstrapData()

  const match = await getPrisma().pickupMatch.findUnique({
    where: {
      id: matchId,
    },
    include: {
      chatEvents: {
        orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
      },
      killEvents: {
        orderBy: [{ eventIndex: "asc" }],
      },
      playerStats: {
        include: {
          player: true,
        },
        orderBy: [{ createdAt: "asc" }],
      },
      players: {
        include: {
          player: true,
        },
      },
      queue: true,
      rawEvents: {
        orderBy: [{ eventIndex: "asc" }],
      },
      season: true,
      statsSummary: true,
      weaponStats: {
        orderBy: [{ weapon: "asc" }],
      },
    },
  })

  if (!match) {
    routeError(404, "Pickup match could not be found.")
  }

  const playerStatsByPlayerId = new Map(
    match.playerStats.map((stat) => [stat.playerId, stat])
  )
  const weaponStatsByPlayerId = new Map<string, PickupPlayerWeaponStat[]>()
  for (const stat of match.weaponStats) {
    const existing = weaponStatsByPlayerId.get(stat.playerId) ?? []
    existing.push(stat)
    weaponStatsByPlayerId.set(stat.playerId, existing)
  }

  const teams = {
    left: [] as PickupMatchPlayerStatsDto[],
    right: [] as PickupMatchPlayerStatsDto[],
  }

  for (const membership of match.players) {
    if (membership.team !== "left" && membership.team !== "right") {
      continue
    }

    const stat = playerStatsByPlayerId.get(membership.playerId)
    teams[membership.team].push({
      accuracy: stat?.accuracy ?? null,
      damageGiven: stat?.damageGiven ?? null,
      damageTaken: stat?.damageTaken ?? null,
      deaths: stat?.deaths ?? null,
      displayAfter: membership.displayAfter ?? null,
      displayBefore: membership.displayBefore,
      kills: stat?.kills ?? null,
      medals:
        stat?.medals && typeof stat.medals === "object"
          ? (stat.medals as Record<string, unknown>)
          : null,
      ping: stat?.ping ?? null,
      player: toPickupPlayerDto(membership.player),
      result:
        membership.won === true
          ? "win"
          : membership.won === false
            ? "loss"
            : null,
      score: stat?.score ?? null,
      team: membership.team,
      timeSeconds: stat?.timeSeconds ?? null,
      weaponStats: (weaponStatsByPlayerId.get(membership.playerId) ?? []).map(
        toPickupMatchWeaponStatDto
      ),
    })
  }

  return {
    chat: match.chatEvents.map(toPickupMatchChatEventDto),
    kills: match.killEvents.map(toPickupMatchKillEventDto),
    match: {
      completedAt: match.completedAt?.toISOString() ?? null,
      finalMapKey: match.finalMapKey ?? null,
      finalScore: match.finalScore ?? null,
      id: match.id,
      liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
      queue: toPickupQueueDto(match.queue),
      season: toPickupSeasonDto(match.season),
      status: match.status,
      winnerTeam: match.winnerTeam ?? null,
    },
    rawEvents: match.rawEvents.map(toPickupRawEventDto),
    statsSummary: toPickupMatchStatsSummaryDto(match.statsSummary),
    teams,
  }
}

export async function getPickupLeaderboards(): Promise<PickupLeaderboardsDto> {
  await ensurePickupBootstrapData()

  const queues = await getPrisma().pickupQueue.findMany({
    where: {
      enabled: true,
    },
    include: {
      seasons: {
        where: {
          status: "active",
        },
        orderBy: {
          startsAt: "desc",
        },
        take: 1,
        include: {
          ratings: {
            include: {
              player: true,
            },
            orderBy: [
              {
                displayRating: "desc",
              },
              {
                wins: "desc",
              },
              {
                updatedAt: "asc",
              },
            ],
            take: 100,
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }, { name: "asc" }],
  })

  return {
    queues: queues.flatMap((queue) => {
      const activeSeason = queue.seasons[0]
      if (!activeSeason) {
        return []
      }

      return [
        {
          entries: activeSeason.ratings.map((entry, index) => ({
            gamesPlayed: entry.gamesPlayed,
            losses: entry.losses,
            player: toPickupPlayerDto(entry.player),
            rank: index + 1,
            rating: entry.displayRating,
            winRate: getPickupWinRate(entry.wins, entry.gamesPlayed),
            wins: entry.wins,
          })),
          queue: toPickupQueueDto(queue),
          season: toPickupSeasonDto(activeSeason),
        } satisfies PickupLeaderboardQueueDto,
      ]
    }),
  }
}

export async function getPickupLandingData(): Promise<PickupLandingDataDto> {
  await ensurePickupBootstrapData()

  const prisma = getPrisma()
  const [liveMatches, recentMatches] = await Promise.all([
    prisma.pickupMatch.findMany({
      where: {
        status: {
          in: ["server_ready", "live"],
        },
      },
      include: {
        players: {
          include: {
            player: true,
          },
          orderBy: {
            joinedAt: "asc",
          },
        },
      },
      orderBy: [
        {
          liveStartedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 4,
    }),
    prisma.pickupMatch.findMany({
      where: {
        status: "completed",
      },
      include: {
        queue: true,
        season: true,
      },
      orderBy: [
        {
          completedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 12,
    }),
  ])

  return {
    liveMatches: liveMatches.map(toPickupLandingMatchState),
    recentMatches: recentMatches.map((match) => ({
      completedAt: match.completedAt?.toISOString() ?? null,
      finalMapKey: match.finalMapKey ?? null,
      finalScore: match.finalScore ?? null,
      id: match.id,
      queue: toPickupQueueDto(match.queue),
      ratingAfter: null,
      ratingBefore: 0,
      ratingDelta: null,
      result: null,
      season: toPickupSeasonDto(match.season),
      team: null,
      winnerTeam: match.winnerTeam ?? null,
    })),
  }
}

export function buildPickupMatchSummary(match: PickupMatch) {
  return {
    finalMapKey: match.finalMapKey,
    id: match.id,
    readyDeadlineAt: match.readyDeadlineAt?.toISOString() ?? null,
    serverIp: match.serverIp ?? null,
    serverJoinAddress: match.serverJoinAddress ?? null,
    serverLocationCountryCode: match.serverLocationCountryCode ?? null,
    serverLocationCountryName: match.serverLocationCountryName ?? null,
    serverPort: match.serverPort ?? null,
    status: match.status,
    vetoDeadlineAt: match.vetoDeadlineAt?.toISOString() ?? null,
    vetoState: match.vetoState,
    winnerTeam: match.winnerTeam ?? null,
  }
}
