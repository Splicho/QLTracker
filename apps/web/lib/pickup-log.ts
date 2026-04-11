import { appendStructuredLog, inferLogLevel } from "@/lib/logger"

function normalizePickupLogMessage(payload: unknown) {
  if (typeof payload === "string") {
    return payload
  }

  if (payload instanceof Error) {
    return payload.stack ?? payload.message
  }

  try {
    return JSON.stringify(
      payload,
      (_key, value) => {
        if (value instanceof Error) {
          return {
            message: value.message,
            name: value.name,
            stack: value.stack ?? null,
          }
        }

        return value
      },
      2
    )
  } catch {
    return String(payload)
  }
}

export async function appendPickupLog(source: string, payload: unknown) {
  const normalizedSource = source.trim()
  const message = normalizePickupLogMessage(payload).trim()

  if (!normalizedSource || !message) {
    return
  }

  await appendStructuredLog({
    category: "pickup",
    level: inferLogLevel(normalizedSource),
    event: normalizedSource,
    source: normalizedSource,
    payload,
  })
}

export function summarizePickupPublicState(
  state:
    | {
        queue: { id: string; slug: string } | null
        queues: Array<{
          currentPlayers: number
          enabled: boolean
          id: string
          playerCount: number
          slug: string
        }>
      }
    | null
    | undefined
) {
  if (!state) {
    return null
  }

  return {
    primaryQueueId: state.queue?.id ?? null,
    primaryQueueSlug: state.queue?.slug ?? null,
    queues: state.queues.map((queue) => ({
      currentPlayers: queue.currentPlayers,
      enabled: queue.enabled,
      id: queue.id,
      playerCount: queue.playerCount,
      slug: queue.slug,
    })),
  }
}

export function summarizePickupPlayerState(
  state:
    | {
        rating?: { displayRating: number } | null
        stage: string
        viewer: { id: string; steamId: string }
        queue?: { joinedAt: string; queueId: string; queueSlug: string }
        match?: {
          id: string
          queueId: string
          readyDeadlineAt: string | null
          status: string
          veto: { deadlineAt: string | null }
          teams: {
            left: Array<{ id: string; readyState: string }>
            right: Array<{ id: string; readyState: string }>
          }
        }
      }
    | null
    | undefined
) {
  if (!state) {
    return null
  }

  if (state.stage === "queue" && state.queue) {
    return {
      rating: state.rating?.displayRating ?? null,
      queueId: state.queue.queueId,
      queueSlug: state.queue.queueSlug,
      stage: state.stage,
      viewerId: state.viewer.id,
      viewerSteamId: state.viewer.steamId,
    }
  }

  if ("match" in state && state.match) {
    const players = [...state.match.teams.left, ...state.match.teams.right]

    return {
      matchId: state.match.id,
      queueId: state.match.queueId,
      readyCount: players.filter((player) => player.readyState === "ready")
        .length,
      readyDeadlineAt: state.match.readyDeadlineAt,
      rating: state.rating?.displayRating ?? null,
      stage: state.stage,
      status: state.match.status,
      vetoDeadlineAt: state.match.veto.deadlineAt,
      viewerId: state.viewer.id,
      viewerSteamId: state.viewer.steamId,
    }
  }

  return {
    rating: state.rating?.displayRating ?? null,
    stage: state.stage,
    viewerId: state.viewer.id,
    viewerSteamId: state.viewer.steamId,
  }
}
