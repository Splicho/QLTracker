export type SlotStatus = "idle" | "provisioning" | "busy"

export type SlotState = {
  gamePort: number
  joinAddress?: string
  matchId: string | null
  queueId: string | null
  redisDb: number
  resultPostedAt: string | null
  slotId: number
  state: SlotStatus
  updatedAt: string
  zmqPort: number
}

export type SlotMetadata = {
  captains: { left: string; right: string } | null
  finalMapKey: string
  matchId: string
  queueId: string
  seasonId: string
  slotId: number
  teams: {
    blue: Array<{ personaName: string; playerId: string; steamId: string }>
    red: Array<{ personaName: string; playerId: string; steamId: string }>
  }
}

export type SlotsResponse = {
  ok: boolean
  slots: SlotState[]
}

export type ActivePickupStatus =
  | "ready_check"
  | "veto"
  | "provisioning"
  | "server_ready"
  | "live"

export type ActivePickup = {
  createdAt: string
  finalMapKey: string | null
  id: string
  liveStartedAt: string | null
  players: Array<{
    isCaptain: boolean
    player: {
      avatarUrl: string | null
      id: string
      personaName: string
      steamId: string
    }
    readyState: "pending" | "ready" | "dropped"
    team: "left" | "right" | null
  }>
  queue: {
    id: string
    name: string
    playerCount: number
    slug: string
    teamSize: number
  }
  readyDeadlineAt: string | null
  serverJoinAddress: string | null
  status: ActivePickupStatus
  vetoDeadlineAt: string | null
}

export type ActivePickupsResponse = {
  ok: boolean
  matches: ActivePickup[]
}

export type AbortPickupResponse = {
  abort: {
    aborted: boolean
    matchId: string
    ok: boolean
    previousStatus?: string
    status: string
    warning?: string
  }
  ok: boolean
  slotId?: number
  slotStopped: boolean
  slotStopWarning?: string
}

export type SlotEvent = {
  type: string
  data: unknown
  timestamp: string
}

export type SlotPlayer = {
  name: string
  steamId: string
  team: string
}

export type SlotEventsResponse = {
  ok: boolean
  events: SlotEvent[]
  players: SlotPlayer[]
}
