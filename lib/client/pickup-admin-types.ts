export type SlotStatus = "idle" | "provisioning" | "busy"

export type SlotState = {
  gamePort: number
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
