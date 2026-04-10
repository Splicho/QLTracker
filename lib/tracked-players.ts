export const TRACKED_PLAYERS_STORAGE_KEY = "qtracker-tracked-players"
const MAX_TRACKED_PLAYER_ALIASES = 12

export type TrackedPlayer = {
  steamId: string
  playerName: string
  aliases: string[]
  addedAt: string
  note: string
}

function isTrackedPlayer(value: unknown): value is TrackedPlayer {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.steamId === "string" &&
    typeof candidate.playerName === "string" &&
    typeof candidate.addedAt === "string" &&
    (candidate.aliases == null || Array.isArray(candidate.aliases)) &&
    (candidate.note == null || typeof candidate.note === "string")
  )
}

function normalizePlayerNote(note: string | null | undefined) {
  return (note ?? "").trim().slice(0, 500)
}

function normalizeTrackedPlayerName(playerName: string | null | undefined) {
  return (playerName ?? "").trim()
}

function normalizeTrackedPlayerAliases(
  aliases: unknown,
  currentPlayerName: string
) {
  if (!Array.isArray(aliases)) {
    return []
  }

  const dedupedAliases: string[] = []
  const seenAliases = new Set<string>([currentPlayerName])

  for (const alias of aliases) {
    if (typeof alias !== "string") {
      continue
    }

    const normalizedAlias = normalizeTrackedPlayerName(alias)
    if (!normalizedAlias || seenAliases.has(normalizedAlias)) {
      continue
    }

    seenAliases.add(normalizedAlias)
    dedupedAliases.push(normalizedAlias)

    if (dedupedAliases.length >= MAX_TRACKED_PLAYER_ALIASES) {
      break
    }
  }

  return dedupedAliases
}

export function mergeTrackedPlayerIdentity(
  player: TrackedPlayer,
  nextPlayerName: string
) {
  const normalizedPlayerName = normalizeTrackedPlayerName(nextPlayerName)
  if (!normalizedPlayerName || player.playerName === normalizedPlayerName) {
    return player
  }

  return {
    ...player,
    playerName: normalizedPlayerName,
    aliases: normalizeTrackedPlayerAliases(
      [player.playerName, ...player.aliases],
      normalizedPlayerName
    ),
  }
}

export function parseTrackedPlayers(rawValue: string) {
  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    const deduped = new Map<string, TrackedPlayer>()

    for (const entry of parsed) {
      if (!isTrackedPlayer(entry)) {
        continue
      }

      const steamId = entry.steamId.trim()
      const playerName = normalizeTrackedPlayerName(entry.playerName)
      if (!steamId || !playerName) {
        continue
      }

      deduped.set(steamId, {
        steamId,
        playerName,
        aliases: normalizeTrackedPlayerAliases(entry.aliases, playerName),
        addedAt: entry.addedAt,
        note: normalizePlayerNote(entry.note),
      })
    }

    return Array.from(deduped.values()).sort((left, right) =>
      left.addedAt.localeCompare(right.addedAt)
    )
  } catch {
    return []
  }
}

export function serializeTrackedPlayers(players: TrackedPlayer[]) {
  return JSON.stringify(players)
}
