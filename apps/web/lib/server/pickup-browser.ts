import type {
  PickupPlayer as PickupPlayerDto,
  PickupPlayerState,
  PickupPublicState,
  PickupRating,
  PickupPlayerLock,
  PickupSeasonalRating,
} from "@/lib/pickup"
import {
  getActivePickupPlayerLock,
  getPreferredPickupPlayerRating,
  getPickupPlayerActiveRatings,
  toPickupActiveRatingDto,
  toPickupPlayerDto,
  toPickupPlayerLockNoticeDto,
  toPickupRatingDto,
} from "@/lib/server/pickup"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"

export type InitialPickupBrowserState = {
  activeLock: PickupPlayerLock | null
  player: PickupPlayerDto | null
  playerState: PickupPlayerState | null
  publicState: PickupPublicState | null
  rating: PickupRating | null
  ratings: PickupSeasonalRating[]
  sessionToken: string
}

async function fetchRealtimeJson<T>(
  path: string,
  init?: RequestInit
): Promise<T | null> {
  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.trim().replace(
    /\/+$/,
    ""
  )
  if (!realtimeUrl) {
    return null
  }

  const response = await fetch(`${realtimeUrl}${path}`, {
    cache: "no-store",
    ...init,
  })

  if (!response.ok) {
    return null
  }

  return (await response.json()) as T
}

export async function getInitialPickupBrowserState(options?: {
  includePublicStateForGuests?: boolean
}): Promise<InitialPickupBrowserState> {
  const session = await getPickupBrowserSession()
  const shouldFetchPublicState =
    session !== null || options?.includePublicStateForGuests === true

  if (!session) {
    return {
      player: null,
      activeLock: null,
      playerState: null,
      publicState: shouldFetchPublicState
        ? ((
            await fetchRealtimeJson<{ ok: boolean; state?: PickupPublicState }>(
              "/api/pickup/public-state"
            )
          )?.state ?? null)
        : null,
      rating: null,
      ratings: [],
      sessionToken: "",
    }
  }

  const [
    preferredRating,
    ratings,
    activeLock,
    publicStatePayload,
    playerStatePayload,
  ] =
    await Promise.all([
      getPreferredPickupPlayerRating(session.player.id),
      getPickupPlayerActiveRatings(session.player.id),
      getActivePickupPlayerLock(session.player.id),
      fetchRealtimeJson<{ ok: boolean; state?: PickupPublicState }>(
        "/api/pickup/public-state"
      ),
      fetchRealtimeJson<{ ok: boolean; state?: PickupPlayerState }>(
        "/api/pickup/me/state",
        {
          headers: {
            Authorization: `Bearer ${session.token}`,
          },
        }
      ),
    ])

  return {
    activeLock: activeLock ? toPickupPlayerLockNoticeDto(activeLock) : null,
    player: toPickupPlayerDto(session.player),
    playerState: playerStatePayload?.state ?? null,
    publicState: publicStatePayload?.state ?? null,
    rating: preferredRating
      ? toPickupRatingDto(preferredRating, preferredRating.season.queue.ranks)
      : null,
    ratings: ratings.map(toPickupActiveRatingDto),
    sessionToken: session.token,
  }
}
