import { useCallback, useEffect, useReducer, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  appendPickupLog,
  summarizePickupPlayerState,
  summarizePickupPublicState,
} from "@/lib/pickup-log"
import {
  applyMockReadyUp,
  applyMockVetoBan,
  createMockPickupState,
  progressMockReadyCheck,
  type PickupMockStage,
} from "@/lib/pickup-mock"
import {
  fetchPickupPlayerState,
  fetchPickupPublicState,
  type PickupPlayer,
  isPickupRealtimeConfigured,
  PickupApiError,
  type PickupPlayerState,
  type PickupQueueSummary,
  type PickupPublicState,
} from "@/lib/pickup"
import { getRealtimeSocket } from "@/lib/realtime"

const pickupMockMode = process.env.NEXT_PUBLIC_PICKUP_MOCK_MODE === "1"
const COMPLETED_MATCH_DISMISS_MS = 12_000

type PickupStateModel = {
  dismissedCompletedMatchId: string | null
  mockStage: PickupMockStage
  playerState: PickupPlayerState | null
  publicState: PickupPublicState | null
  readyActionPending: boolean
}

type PickupStateAction =
  | { type: "apply_player_state"; nextState: PickupPlayerState }
  | {
      type: "dismiss_completed_match"
      idleState: PickupPlayerState
      matchId: string
    }
  | { type: "reset_session" }
  | { type: "set_mock_stage"; stage: PickupMockStage }
  | { type: "set_public_state"; nextState: PickupPublicState }
  | { type: "set_ready_action_pending"; value: boolean }

function createInitialPickupState({
  initialPlayerState,
  initialPublicState,
}: {
  initialPlayerState: PickupPlayerState | null
  initialPublicState: PickupPublicState | null
}): PickupStateModel {
  return {
    dismissedCompletedMatchId: null,
    mockStage: "idle",
    playerState: initialPlayerState,
    publicState: initialPublicState,
    readyActionPending: false,
  }
}

function pickupStateReducer(
  state: PickupStateModel,
  action: PickupStateAction
): PickupStateModel {
  switch (action.type) {
    case "apply_player_state": {
      const nextState = action.nextState

      if (
        nextState.stage === "completed" &&
        nextState.match.id === state.dismissedCompletedMatchId
      ) {
        return state
      }

      const viewerReady =
        nextState.stage === "ready_check"
          ? [
              ...nextState.match.teams.left,
              ...nextState.match.teams.right,
            ].some(
              (player) =>
                player.id === nextState.viewer.id &&
                player.readyState === "ready"
            )
          : false

      return {
        ...state,
        dismissedCompletedMatchId:
          nextState.stage === "completed"
            ? state.dismissedCompletedMatchId
            : null,
        playerState: nextState,
        publicState: nextState.publicState,
        readyActionPending:
          nextState.stage === "ready_check"
            ? viewerReady
              ? false
              : state.readyActionPending
            : false,
      }
    }
    case "dismiss_completed_match":
      return {
        ...state,
        dismissedCompletedMatchId: action.matchId,
        playerState: action.idleState,
        publicState: action.idleState.publicState,
        readyActionPending: false,
      }
    case "reset_session":
      return {
        ...state,
        dismissedCompletedMatchId: null,
        playerState: null,
        readyActionPending: false,
      }
    case "set_mock_stage":
      return {
        ...state,
        mockStage: action.stage,
      }
    case "set_public_state":
      return {
        ...state,
        publicState: action.nextState,
      }
    case "set_ready_action_pending":
      return {
        ...state,
        readyActionPending: action.value,
      }
    default:
      return state
  }
}

export function usePickupState(
  sessionToken: string,
  enabled = true,
  viewer: PickupPlayer | null = null,
  initialPublicState: PickupPublicState | null = null,
  initialPlayerState: PickupPlayerState | null = null
) {
  const realtimeAvailable = isPickupRealtimeConfigured()
  const mockMode = pickupMockMode
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(
    pickupStateReducer,
    {
      initialPlayerState,
      initialPublicState,
    },
    createInitialPickupState
  )
  const hasReceivedRealtimePublicStateRef = useRef(false)
  const hasReceivedRealtimePlayerStateRef = useRef(false)
  const lastLoggedPublicStateRef = useRef<string | null>(null)
  const lastLoggedPlayerStateRef = useRef<string | null>(null)
  const latestPlayerStateRef = useRef<PickupPlayerState | null>(
    initialPlayerState
  )
  const { mockStage, playerState, publicState, readyActionPending } = state

  const logPublicStateSnapshot = useCallback(
    (source: string, nextState: PickupPublicState) => {
      const summary = summarizePickupPublicState(nextState)
      const nextKey = JSON.stringify(summary)
      if (lastLoggedPublicStateRef.current === nextKey) {
        return
      }

      lastLoggedPublicStateRef.current = nextKey
      void appendPickupLog(source, summary)
    },
    []
  )

  const logPlayerStateSnapshot = useCallback(
    (source: string, nextState: PickupPlayerState) => {
      const summary = summarizePickupPlayerState(nextState)
      const nextKey = JSON.stringify(summary)
      if (lastLoggedPlayerStateRef.current === nextKey) {
        return
      }

      lastLoggedPlayerStateRef.current = nextKey
      void appendPickupLog(source, summary)
    },
    []
  )

  const buildIdleState = (
    nextViewer: PickupPlayer,
    nextPublicState: PickupPublicState,
    rating: PickupPlayerState["rating"]
  ): PickupPlayerState => ({
    publicState: nextPublicState,
    rating,
    stage: "idle",
    viewer: nextViewer,
  })

  const publicQuery = useQuery({
    queryKey: ["pickup", "public-state"],
    queryFn: fetchPickupPublicState,
    enabled: enabled && realtimeAvailable && !mockMode,
    initialData: initialPublicState ?? undefined,
    refetchInterval: 15000,
  })

  const playerQuery = useQuery({
    queryKey: ["pickup", "player-state", sessionToken],
    queryFn: () => fetchPickupPlayerState(sessionToken),
    enabled:
      enabled &&
      realtimeAvailable &&
      sessionToken.trim().length > 0 &&
      !mockMode,
    initialData:
      initialPlayerState && sessionToken.trim().length > 0
        ? initialPlayerState
        : undefined,
    retry: (failureCount, error) => {
      if (
        error instanceof PickupApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        return false
      }
      return failureCount < 2
    },
  })
  const refetchPublicState = publicQuery.refetch
  const refetchPlayerState = playerQuery.refetch

  const applyNextPlayerState = useCallback((nextState: PickupPlayerState) => {
    dispatch({
      type: "apply_player_state",
      nextState,
    })
  }, [])

  useEffect(() => {
    latestPlayerStateRef.current = playerState
  }, [playerState])

  useEffect(() => {
    hasReceivedRealtimePublicStateRef.current = false
    hasReceivedRealtimePlayerStateRef.current = false
    lastLoggedPublicStateRef.current = null
    lastLoggedPlayerStateRef.current = null
    dispatch({
      type: "reset_session",
    })
  }, [sessionToken])

  useEffect(() => {
    if (!mockMode || !enabled) {
      return
    }

    const nextState = createMockPickupState(mockStage, viewer)
    applyNextPlayerState(nextState)
  }, [applyNextPlayerState, enabled, mockMode, mockStage, viewer])

  useEffect(() => {
    if (!playerState || playerState.stage !== "completed") {
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (mockMode) {
        dispatch({
          type: "set_mock_stage",
          stage: "idle",
        })
        return
      }

      dispatch({
        type: "dismiss_completed_match",
        idleState: buildIdleState(
          playerState.viewer,
          playerState.publicState,
          playerState.rating
        ),
        matchId: playerState.match.id,
      })
    }, COMPLETED_MATCH_DISMISS_MS)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [applyNextPlayerState, mockMode, playerState])

  useEffect(() => {
    if (!mockMode || playerState?.stage !== "ready_check") {
      return
    }

    const players = [
      ...playerState.match.teams.left,
      ...playerState.match.teams.right,
    ]
    const viewerReady = players.some(
      (player) =>
        player.id === playerState.viewer.id && player.readyState === "ready"
    )
    const allReady = players.every((player) => player.readyState === "ready")

    if (allReady) {
      const nextState = createMockPickupState("veto", playerState.viewer)
      applyNextPlayerState(nextState)
      dispatch({
        type: "set_mock_stage",
        stage: "veto",
      })
      return
    }

    if (!viewerReady) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      const currentPlayerState = latestPlayerStateRef.current

      if (!currentPlayerState || currentPlayerState.stage !== "ready_check") {
        return
      }

      const nextState = progressMockReadyCheck(currentPlayerState)
      applyNextPlayerState(nextState)
      if (nextState.stage === "veto") {
        dispatch({
          type: "set_mock_stage",
          stage: "veto",
        })
      }
    }, 850)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [applyNextPlayerState, mockMode, playerState])

  useEffect(() => {
    if (publicQuery.data) {
      if (realtimeAvailable && hasReceivedRealtimePublicStateRef.current) {
        return
      }

      dispatch({
        type: "set_public_state",
        nextState: publicQuery.data,
      })
      queryClient.setQueryData(["pickup", "public-state"], publicQuery.data)
      logPublicStateSnapshot("pickup.query.public_state", publicQuery.data)
    }
  }, [logPublicStateSnapshot, publicQuery.data, queryClient, realtimeAvailable])

  useEffect(() => {
    if (playerQuery.data) {
      if (realtimeAvailable && hasReceivedRealtimePlayerStateRef.current) {
        return
      }

      applyNextPlayerState(playerQuery.data)
      logPlayerStateSnapshot("pickup.query.player_state", playerQuery.data)
    }
  }, [
    applyNextPlayerState,
    logPlayerStateSnapshot,
    playerQuery.data,
    realtimeAvailable,
  ])

  useEffect(() => {
    if (!publicQuery.error) {
      return
    }

    void appendPickupLog("pickup.query.public_state.error", {
      error:
        publicQuery.error instanceof Error
          ? publicQuery.error.message
          : String(publicQuery.error),
    })
  }, [publicQuery.error])

  useEffect(() => {
    if (!playerQuery.error) {
      return
    }

    void appendPickupLog("pickup.query.player_state.error", {
      error:
        playerQuery.error instanceof Error
          ? playerQuery.error.message
          : String(playerQuery.error),
      sessionTokenPresent: sessionToken.trim().length > 0,
    })
  }, [playerQuery.error, sessionToken])

  useEffect(() => {
    if (!enabled || !realtimeAvailable || mockMode) {
      return
    }

    const socket = getRealtimeSocket()
    if (!socket) {
      return
    }

    const handlePublicState = (nextState: PickupPublicState) => {
      hasReceivedRealtimePublicStateRef.current = true
      dispatch({
        type: "set_public_state",
        nextState,
      })
      queryClient.setQueryData(["pickup", "public-state"], nextState)
      logPublicStateSnapshot("pickup.socket.public_state", nextState)
    }

    const handlePlayerState = (nextState: PickupPlayerState) => {
      hasReceivedRealtimePlayerStateRef.current = true
      applyNextPlayerState(nextState)
      logPlayerStateSnapshot("pickup.socket.player_state", nextState)
    }

    const handlePickupError = (payload: { message?: string }) => {
      dispatch({
        type: "set_ready_action_pending",
        value: false,
      })
      void appendPickupLog("pickup.socket.error", payload)
      if (payload.message) {
        toast.error(payload.message)
      }
    }

    const handleConnect = () => {
      void appendPickupLog("pickup.socket.connected", {
        hasSessionToken: sessionToken.trim().length > 0,
      })
      void refetchPublicState()
      if (sessionToken.trim().length > 0) {
        void refetchPlayerState()
      }
    }

    socket.on("connect", handleConnect)
    socket.on("pickup:public-state", handlePublicState)
    socket.on("pickup:state", handlePlayerState)
    socket.on("pickup:error", handlePickupError)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off("connect", handleConnect)
      socket.off("pickup:public-state", handlePublicState)
      socket.off("pickup:state", handlePlayerState)
      socket.off("pickup:error", handlePickupError)
    }
  }, [
    applyNextPlayerState,
    enabled,
    logPlayerStateSnapshot,
    logPublicStateSnapshot,
    mockMode,
    queryClient,
    realtimeAvailable,
    refetchPlayerState,
    refetchPublicState,
    sessionToken,
  ])

  useEffect(() => {
    if (
      mockMode ||
      !enabled ||
      !playerState ||
      playerState.stage !== "ready_check" ||
      !playerState.match.readyDeadlineAt
    ) {
      return
    }

    let cancelled = false
    let fallbackIntervalId: number | null = null
    const deadlineMs = new Date(playerState.match.readyDeadlineAt).getTime()

    const refreshAuthoritativeState = async () => {
      const [nextPublicResult, nextPlayerResult] = await Promise.all([
        refetchPublicState(),
        sessionToken.trim().length > 0
          ? refetchPlayerState()
          : Promise.resolve(null),
      ])

      if (cancelled) {
        return
      }

      void appendPickupLog("pickup.ready_timeout.refetch", {
        deadlineAt: playerState.match.readyDeadlineAt,
        matchId: playerState.match.id,
      })
      if (nextPublicResult?.data) {
        dispatch({
          type: "set_public_state",
          nextState: nextPublicResult.data,
        })
        queryClient.setQueryData(["pickup", "public-state"], nextPublicResult.data)
        logPublicStateSnapshot(
          "pickup.ready_timeout.public_state",
          nextPublicResult.data
        )
      }

      if (nextPlayerResult?.data) {
        applyNextPlayerState(nextPlayerResult.data)
        logPlayerStateSnapshot(
          "pickup.ready_timeout.player_state",
          nextPlayerResult.data
        )
      }
    }

    const timeoutId = window.setTimeout(
      () => {
        void refreshAuthoritativeState()
        fallbackIntervalId = window.setInterval(() => {
          void refreshAuthoritativeState()
        }, 2000)
      },
      Math.max(0, deadlineMs - Date.now()) + 250
    )

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (fallbackIntervalId !== null) {
        window.clearInterval(fallbackIntervalId)
      }
    }
  }, [
    applyNextPlayerState,
    enabled,
    logPlayerStateSnapshot,
    logPublicStateSnapshot,
    mockMode,
    queryClient,
    refetchPlayerState,
    playerState,
    refetchPublicState,
    sessionToken,
  ])

  const emit = (eventName: string, payload?: unknown) => {
    const socket = getRealtimeSocket()
    if (!socket) {
      toast.error("Realtime pickup service is unavailable.")
      void appendPickupLog("pickup.emit.unavailable", {
        eventName,
        payload: payload ?? null,
      })
      return false
    }

    if (!socket.connected) {
      socket.connect()
    }

    void appendPickupLog("pickup.emit", {
      connected: socket.connected,
      eventName,
      payload: payload ?? null,
    })
    socket.emit(eventName, payload)
    return true
  }

  return {
    joinQueue: (queue: PickupQueueSummary) => {
      if (mockMode) {
        dispatch({
          type: "set_mock_stage",
          stage: "queue",
        })
        return
      }

      emit("pickup:queue:join", {
        queueId: queue.id,
        queueSlug: queue.slug,
      })
    },
    leaveQueue: () => {
      if (mockMode) {
        dispatch({
          type: "set_mock_stage",
          stage: "idle",
        })
        return
      }

      emit("pickup:queue:leave")
    },
    mockMode,
    mockStage,
    playerState,
    publicState,
    readyUp: () => {
      if (mockMode) {
        const currentPlayerState = latestPlayerStateRef.current

        if (!currentPlayerState) {
          return
        }

        applyNextPlayerState(applyMockReadyUp(currentPlayerState))
        return
      }

      if (emit("pickup:lobby:ready")) {
        dispatch({
          type: "set_ready_action_pending",
          value: true,
        })
      }
    },
    readyActionPending,
    setMockStage: (stage: PickupMockStage) => {
      if (mockMode) {
        dispatch({
          type: "set_mock_stage",
          stage,
        })
      }
    },
    stateLoading: mockMode
      ? false
      : publicQuery.isLoading || playerQuery.isLoading,
    vetoBan: (mapKey: string) => {
      if (mockMode) {
        const currentPlayerState = latestPlayerStateRef.current

        if (!currentPlayerState) {
          return
        }

        applyNextPlayerState(applyMockVetoBan(currentPlayerState, mapKey))
        return
      }

      emit("pickup:veto:ban", { mapKey })
    },
  }
}
