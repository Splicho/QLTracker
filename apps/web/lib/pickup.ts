const pickupApiUrl =
  process.env.NEXT_PUBLIC_PICKUP_API_URL?.trim().replace(/\/+$/, "") || ""

const realtimeUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(/\/+$/, "") || ""
const realtimeApiBasePath = "/api/realtime"

export const PICKUP_API_URL = pickupApiUrl
export const PICKUP_REALTIME_URL = realtimeUrl

export type PickupPlayer = {
  avatarUrl: string | null
  coverImageUrl?: string | null
  countryCode?: string | null
  customAvatarUrl?: string | null
  id: string
  isAdmin: boolean
  personaName: string
  profileUrl: string | null
  steamId: string
  steamAvatarUrl?: string | null
}

export type PickupRating = {
  displayRating: number
  gamesPlayed: number
  losses: number
  mu: number
  sigma: number
  wins: number
}

export type PickupSeasonalRating = PickupRating & {
  queueId: string
  queueName: string
  queueSlug: string
  seasonId: string
  seasonName: string
}

export type PickupLinkSession = {
  authorizeUrl: string
  expiresAt: string
  id: string
}

export type PickupLinkSessionResult = {
  errorMessage?: string | null
  expiresAt: string
  id: string
  player?: PickupPlayer | null
  sessionToken?: string
  status: "pending" | "complete" | "expired" | "error"
}

export type PickupQueuedPlayer = {
  avatarUrl: string | null
  countryCode?: string | null
  id: string
  joinedAt: string
  personaName: string
  profileUrl: string | null
  steamId: string
}

export type PickupQueueSummary = {
  currentPlayers: number
  description: string | null
  enabled: boolean
  id: string
  name: string
  playerCount: number
  players: PickupQueuedPlayer[]
  readyCheckDurationSeconds: number
  slug: string
  teamSize: number
  vetoTurnDurationSeconds: number
}

export type PickupQueueInfo = {
  description: string | null
  enabled: boolean
  id: string
  name: string
  playerCount: number
  slug: string
  teamSize: number
}

export type PickupPublicState = {
  queue: PickupQueueSummary | null
  queues: PickupQueueSummary[]
  season: {
    endsAt: string
    id: string
    name: string
    startsAt: string
    status: string
  } | null
}

export type PickupMatchPlayerCard = {
  avatarUrl: string | null
  countryCode?: string | null
  displayAfter: number | null
  displayBefore: number
  id: string
  isCaptain: boolean
  joinedAt: string
  personaName: string
  profileUrl: string | null
  readyConfirmedAt: string | null
  readyState: "pending" | "ready" | "dropped"
  steamId: string
  team: "left" | "right" | null
  won: boolean | null
}

export type PickupMatchState = {
  balanceSummary: {
    captainPlayerIds: {
      left: string
      right: string
    }
    ratingDelta: number
    teamRatings: {
      left: number
      right: number
    }
  } | null
  completedAt: string | null
  finalMapKey: string | null
  finalScore: string | null
  id: string
  liveStartedAt: string | null
  queueId: string
  readyDeadlineAt: string | null
  seasonId: string
  server: {
    countryCode: string | null
    countryName: string | null
    ip: string | null
    joinAddress: string | null
    port: number | null
    provisionedAt: string | null
  }
  status:
    | "ready_check"
    | "veto"
    | "provisioning"
    | "server_ready"
    | "live"
    | "completed"
  teams: {
    left: PickupMatchPlayerCard[]
    right: PickupMatchPlayerCard[]
  }
  veto: {
    availableMaps: string[]
    bannedMaps: string[]
    currentCaptainPlayerId: string | null
    deadlineAt: string | null
    turns: Array<{
      captainPlayerId: string
      mapKey: string
      order: number
      reason: "captain" | "timeout"
    }>
  }
  winnerTeam: "left" | "right" | null
}

export type PickupLeaderboardEntry = {
  gamesPlayed: number
  losses: number
  player: PickupPlayer
  rank: number
  rating: number
  winRate: number | null
  wins: number
}

export type PickupLeaderboardQueue = {
  entries: PickupLeaderboardEntry[]
  queue: PickupQueueInfo
  season: {
    endsAt: string
    id: string
    name: string
    startsAt: string
    status: string
  }
}

export type PickupLeaderboards = {
  queues: PickupLeaderboardQueue[]
}

export type PickupProfileStats = {
  losses: number
  totalMatches: number
  winRate: number | null
  wins: number
}

export type PickupProfileMatch = {
  completedAt: string | null
  finalMapKey: string | null
  finalScore: string | null
  id: string
  queue: PickupQueueInfo
  ratingAfter: number | null
  ratingBefore: number
  ratingDelta: number | null
  result: "win" | "loss" | null
  season: {
    endsAt: string
    id: string
    name: string
    startsAt: string
    status: string
  }
  team: "left" | "right" | null
  winnerTeam: "left" | "right" | null
}

export type PickupLandingData = {
  liveMatches: PickupMatchState[]
  recentMatches: PickupProfileMatch[]
}

export type PickupPlayerProfile = {
  player: PickupPlayer
  ratings: PickupSeasonalRating[]
  recentMatches: PickupProfileMatch[]
  stats: PickupProfileStats
}

export type PickupMatchWeaponStat = {
  accuracy: number | null
  damage: number | null
  deaths: number | null
  hits: number | null
  kills: number | null
  shots: number | null
  timeSeconds: number | null
  weapon: string
}

export type PickupMatchPlayerStats = {
  accuracy: number | null
  damageGiven: number | null
  damageTaken: number | null
  deaths: number | null
  displayAfter: number | null
  displayBefore: number
  kills: number | null
  medals: Record<string, unknown> | null
  ping: number | null
  player: PickupPlayer
  result: "win" | "loss" | null
  score: number | null
  team: "left" | "right" | null
  timeSeconds: number | null
  weaponStats: PickupMatchWeaponStat[]
}

export type PickupMatchKillEvent = {
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

export type PickupMatchDetail = {
  kills: PickupMatchKillEvent[]
  match: {
    completedAt: string | null
    finalMapKey: string | null
    finalScore: string | null
    id: string
    liveStartedAt: string | null
    queue: PickupQueueInfo
    season: {
      endsAt: string
      id: string
      name: string
      startsAt: string
      status: string
    }
    status:
      | "ready_check"
      | "veto"
      | "provisioning"
      | "server_ready"
      | "live"
      | "completed"
      | "cancelled"
    winnerTeam: "left" | "right" | null
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
    left: PickupMatchPlayerStats[]
    right: PickupMatchPlayerStats[]
  }
}

export type PickupNoticeVariant = "success" | "danger" | "alert" | "info"

export type PickupNotice = {
  content: string
  dismissable: boolean
  id: string
  linkHref: string | null
  linkLabel: string | null
  variant: PickupNoticeVariant
}

export type PickupPlayerState =
  | {
      publicState: PickupPublicState
      rating: PickupRating | null
      serverNow: string
      stage: "idle"
      viewer: PickupPlayer
    }
  | {
      publicState: PickupPublicState
      queue: {
        joinedAt: string
        playerCount: number
        queueId: string
        queueName?: string
        queueSlug: string
      }
      rating: PickupRating | null
      serverNow: string
      stage: "queue"
      viewer: PickupPlayer
    }
  | {
      match: PickupMatchState
      publicState: PickupPublicState
      rating: PickupRating | null
      serverNow: string
      stage:
        | "ready_check"
        | "veto"
        | "provisioning"
        | "server_ready"
        | "live"
        | "completed"
      viewer: PickupPlayer
    }

export class PickupApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "PickupApiError"
    this.status = status
  }
}

function requirePickupApiUrl() {
  return PICKUP_API_URL
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function requestPickupApi<T>(
  path: string,
  options: RequestInit = {},
  sessionToken?: string
) {
  const baseUrl = requirePickupApiUrl()
  const headers = new Headers(options.headers)
  if (
    !headers.has("Content-Type") &&
    options.body != null &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json")
  }
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = `Pickup API returned HTTP ${response.status}.`

    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) {
        message = payload.message
      }
    } catch {
      // Ignore invalid error payloads.
    }

    throw new PickupApiError(response.status, message)
  }

  return parseJsonResponse<T>(response)
}

export function isPickupApiConfigured() {
  return true
}

export function isPickupRealtimeConfigured() {
  return PICKUP_REALTIME_URL.length > 0
}

export async function createPickupSteamLinkSession() {
  return requestPickupApi<PickupLinkSession>(
    "/api/pickup/auth/steam/link-sessions",
    {
      method: "POST",
    }
  )
}

export async function fetchPickupSteamLinkSession(id: string) {
  return requestPickupApi<PickupLinkSessionResult>(
    `/api/pickup/auth/steam/link-sessions/${encodeURIComponent(id)}`
  )
}

export async function fetchPickupMe(sessionToken: string) {
  return requestPickupApi<{
    player: PickupPlayer
    rating: PickupRating | null
    ratings?: PickupSeasonalRating[]
  }>("/api/pickup/me", undefined, sessionToken)
}

export async function logoutPickupSession(sessionToken: string) {
  return requestPickupApi<{ ok: boolean }>(
    "/api/pickup/auth/logout",
    {
      method: "POST",
    },
    sessionToken
  )
}

export async function disconnectPickupAccount(sessionToken: string) {
  return requestPickupApi<{ ok: boolean }>(
    "/api/pickup/me",
    {
      method: "DELETE",
    },
    sessionToken
  )
}

export async function fetchPickupLeaderboards() {
  try {
    return await requestPickupApi<PickupLeaderboards>(
      "/api/pickup/leaderboards"
    )
  } catch (error) {
    if (error instanceof PickupApiError && error.status === 404) {
      return { queues: [] } satisfies PickupLeaderboards
    }

    throw error
  }
}

export async function fetchPickupLandingData() {
  return requestPickupApi<PickupLandingData>("/api/pickup/landing")
}

export async function fetchPickupPlayerProfile(playerId: string) {
  return requestPickupApi<{ profile: PickupPlayerProfile }>(
    `/api/pickup/players/${encodeURIComponent(playerId)}`
  ).then((payload) => payload.profile)
}

export async function fetchPickupMatchDetail(matchId: string) {
  return requestPickupApi<{ match: PickupMatchDetail }>(
    `/api/pickup/matches/${encodeURIComponent(matchId)}`
  ).then((payload) => payload.match)
}

export async function uploadPickupProfileImage(
  sessionToken: string,
  kind: "avatar" | "cover",
  file: File
) {
  const formData = new FormData()
  formData.append("kind", kind)
  formData.append("file", file)

  return requestPickupApi<{
    contentType: string
    kind: "avatar" | "cover"
    key: string
    url: string
  }>(
    "/api/pickup/me/profile/upload",
    {
      body: formData,
      method: "POST",
    },
    sessionToken
  )
}

export async function updatePickupProfileMedia(
  sessionToken: string,
  input: {
    countryCode?: string | null
    customAvatarUrl?: string | null
    customCoverUrl?: string | null
  }
) {
  return requestPickupApi<{ player: PickupPlayer }>(
    "/api/pickup/me/profile",
    {
      body: JSON.stringify(input),
      method: "PATCH",
    },
    sessionToken
  )
}

export async function fetchPickupNotices() {
  try {
    const payload = await requestPickupApi<{ notices: PickupNotice[] }>(
      "/api/notices"
    )
    return payload.notices
  } catch (error) {
    if (error instanceof PickupApiError && error.status === 404) {
      return [] satisfies PickupNotice[]
    }

    throw error
  }
}

export async function fetchPickupPublicState() {
  if (!PICKUP_REALTIME_URL) {
    throw new Error("NEXT_PUBLIC_REALTIME_URL is not configured.")
  }

  const url = `${realtimeApiBasePath}/pickup/public-state`
  const response = await fetch(url, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new PickupApiError(
      response.status,
      "Pickup realtime state is unavailable."
    )
  }

  const payload = (await response.json()) as {
    ok: boolean
    state: PickupPublicState
  }
  return payload.state
}

export async function fetchPickupPlayerState(sessionToken: string) {
  if (!PICKUP_REALTIME_URL) {
    throw new Error("NEXT_PUBLIC_REALTIME_URL is not configured.")
  }

  const url = `${realtimeApiBasePath}/pickup/me/state`
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  })
  if (!response.ok) {
    throw new PickupApiError(
      response.status,
      "Pickup player state is unavailable."
    )
  }

  const payload = (await response.json()) as {
    ok: boolean
    state: PickupPlayerState
  }
  return payload.state
}
