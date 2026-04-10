import { useEffect, useReducer, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { openExternalUrl } from "@/lib/open-url"
import {
  LEGACY_PICKUP_GUEST_STORAGE_KEY,
  LEGACY_PICKUP_SESSION_STORAGE_KEY,
  PICKUP_GUEST_STORAGE_KEY,
  PICKUP_SESSION_STORAGE_KEY,
} from "@/lib/pickup-auth-storage"
import { appendPickupLog } from "@/lib/pickup-log"
import {
  createPickupSteamLinkSession,
  fetchPickupMe,
  fetchPickupSteamLinkSession,
  isPickupApiConfigured,
  logoutPickupSession,
  PickupApiError,
  type PickupPlayer,
  type PickupRating,
  type PickupSeasonalRating,
} from "@/lib/pickup"
import { setRealtimePickupToken } from "@/lib/realtime"

export type InitialPickupAuthState = {
  player: PickupPlayer | null
  rating: PickupRating | null
  ratings: PickupSeasonalRating[]
  sessionToken: string
}

export function usePickupAuth(initialState?: InitialPickupAuthState) {
  const queryClient = useQueryClient()
  const pickupAvailable = isPickupApiConfigured()
  const [rawSessionToken, setRawSessionToken] = useLocalStorage(
    PICKUP_SESSION_STORAGE_KEY,
    initialState?.sessionToken ?? ""
  )
  const [rawGuestMode, setRawGuestMode] = useLocalStorage(
    PICKUP_GUEST_STORAGE_KEY,
    initialState?.sessionToken ? "false" : "false"
  )
  const sessionToken = rawSessionToken.trim()
  const guestMode = rawGuestMode === "true"
  const [linkSessionId, setLinkSessionId] = useReducer(
    (_currentState: string | null, nextState: string | null) => nextState,
    null
  )
  const handledLinkStateRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") {
      return
    }

    const hasNextSession = window.localStorage.getItem(
      PICKUP_SESSION_STORAGE_KEY
    )
    const hasNextGuestMode = window.localStorage.getItem(
      PICKUP_GUEST_STORAGE_KEY
    )
    const legacySessionToken = window.localStorage.getItem(
      LEGACY_PICKUP_SESSION_STORAGE_KEY
    )
    const legacyGuestMode = window.localStorage.getItem(
      LEGACY_PICKUP_GUEST_STORAGE_KEY
    )

    if (!hasNextSession && legacySessionToken) {
      setRawSessionToken(legacySessionToken)
    }

    if (!hasNextGuestMode && legacyGuestMode) {
      setRawGuestMode(legacyGuestMode)
    }

    if (legacySessionToken || legacyGuestMode) {
      window.localStorage.removeItem(LEGACY_PICKUP_SESSION_STORAGE_KEY)
      window.localStorage.removeItem(LEGACY_PICKUP_GUEST_STORAGE_KEY)
    }
  }, [setRawGuestMode, setRawSessionToken])

  useEffect(() => {
    setRealtimePickupToken(sessionToken)
    void appendPickupLog("pickup.auth.session", {
      guestMode,
      hasSessionToken: sessionToken.length > 0,
      isLinking: linkSessionId !== null,
      sessionTokenLength: sessionToken.length,
    })
  }, [guestMode, linkSessionId, sessionToken])

  const meQuery = useQuery({
    queryKey: ["pickup", "me", sessionToken],
    queryFn: () => fetchPickupMe(sessionToken),
    enabled: pickupAvailable && sessionToken.length > 0,
    initialData:
      initialState?.sessionToken &&
      initialState.sessionToken === sessionToken &&
      initialState.player
        ? {
            player: initialState.player,
            rating: initialState.rating,
            ratings: initialState.ratings,
          }
        : undefined,
    retry: (failureCount, error) => {
      if (error instanceof PickupApiError && error.status === 401) {
        return false
      }
      return failureCount < 2
    },
  })

  useEffect(() => {
    if (!meQuery.data) {
      return
    }

    void appendPickupLog("pickup.auth.me.success", {
      playerId: meQuery.data.player.id,
      personaName: meQuery.data.player.personaName,
      rating: meQuery.data.rating?.displayRating ?? null,
      ratingsCount: meQuery.data.ratings?.length ?? 0,
      steamId: meQuery.data.player.steamId,
    })
  }, [meQuery.data])

  useEffect(() => {
    if (!meQuery.error) {
      return
    }

    void appendPickupLog("pickup.auth.me.error", {
      error:
        meQuery.error instanceof Error
          ? meQuery.error.message
          : String(meQuery.error),
      isPickupApiError: meQuery.error instanceof PickupApiError,
      sessionTokenPresent: sessionToken.length > 0,
      status:
        meQuery.error instanceof PickupApiError ? meQuery.error.status : null,
    })
  }, [meQuery.error, sessionToken])

  useEffect(() => {
    if (
      meQuery.error instanceof PickupApiError &&
      meQuery.error.status === 401 &&
      sessionToken.length > 0
    ) {
      setRawSessionToken("")
    }
  }, [meQuery.error, sessionToken, setRawSessionToken])

  const linkSessionQuery = useQuery({
    queryKey: ["pickup", "link-session", linkSessionId],
    queryFn: () => fetchPickupSteamLinkSession(linkSessionId!),
    enabled: pickupAvailable && linkSessionId !== null,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  })

  useEffect(() => {
    const result = linkSessionQuery.data
    if (!result || handledLinkStateRef.current === result.id) {
      return
    }

    void appendPickupLog("pickup.auth.link_session.state", {
      id: result.id,
      status: result.status,
      hasSessionToken: Boolean(result.sessionToken),
      playerId: result.player?.id ?? null,
    })

    if (result.status === "complete" && result.sessionToken) {
      handledLinkStateRef.current = result.id
      setRawGuestMode("false")
      setRawSessionToken(result.sessionToken)
      setLinkSessionId(null)
      toast.success("Steam linked for pickups.")
      void queryClient.invalidateQueries({
        queryKey: ["pickup"],
      })
      return
    }

    if (result.status === "expired" || result.status === "error") {
      handledLinkStateRef.current = result.id
      setLinkSessionId(null)
      toast.error(
        result.errorMessage ?? "Steam pickup sign-in did not complete."
      )
    }
  }, [linkSessionQuery.data, queryClient, setRawGuestMode, setRawSessionToken])

  const connectMutation = useMutation({
    mutationFn: createPickupSteamLinkSession,
    onSuccess: async (result) => {
      void appendPickupLog("pickup.auth.link_session.created", {
        expiresAt: result.expiresAt,
        id: result.id,
      })
      handledLinkStateRef.current = null
      setLinkSessionId(result.id)
      openExternalUrl(result.authorizeUrl)
    },
    onError: (error) => {
      void appendPickupLog("pickup.auth.link_session.error", {
        error: error instanceof Error ? error.message : String(error),
      })
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not start the Steam pickup sign-in flow."
      )
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!sessionToken) {
        return
      }

      await logoutPickupSession(sessionToken)
    },
    onSettled: () => {
      void appendPickupLog("pickup.auth.logout", {
        hadSessionToken: sessionToken.length > 0,
      })
      setRawGuestMode("true")
      setRawSessionToken("")
      setLinkSessionId(null)
      void queryClient.invalidateQueries({
        queryKey: ["pickup"],
      })
    },
  })

  const isAuthenticated =
    sessionToken.length > 0 && Boolean(meQuery.data?.player)
  const ratings =
    meQuery.data?.ratings && meQuery.data.ratings.length > 0
      ? meQuery.data.ratings
      : meQuery.data?.rating
        ? [
            {
              ...meQuery.data.rating,
              queueId: "fallback",
              queueName: "Current Rating",
              queueSlug: "current-rating",
              seasonId: "fallback",
              seasonName: "Current Season",
            },
          ]
        : []

  return {
    connectWithSteam: () => connectMutation.mutate(),
    continueAsGuest: () => {
      setRawGuestMode("true")
      setRawSessionToken("")
    },
    guestMode,
    hasResolvedMode: guestMode || sessionToken.length > 0,
    isAuthenticated,
    isLinking:
      connectMutation.isPending ||
      linkSessionQuery.fetchStatus === "fetching" ||
      linkSessionId !== null,
    pickupAvailable,
    player: meQuery.data?.player ?? null,
    rating: meQuery.data?.rating ?? null,
    ratings,
    sessionToken,
    showAuthGate:
      pickupAvailable &&
      !guestMode &&
      sessionToken.length === 0 &&
      linkSessionId === null,
    signOut: () => logoutMutation.mutate(),
    userLoading: meQuery.isLoading,
  }
}
