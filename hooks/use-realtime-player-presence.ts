import { useEffect, useReducer } from "react"
import {
  fetchRealtimePlayerPresence,
  getRealtimeSocket,
  isRealtimeEnabled,
  type RealtimePlayerPresence,
} from "@/lib/realtime"
import { appendRealtimeLog } from "@/lib/realtime-log"

type PlayerPresencePayload = {
  steamId: string
  presence: RealtimePlayerPresence | null
}

type PresenceState = {
  hasResolved: boolean
  isConnected: boolean
  presence: RealtimePlayerPresence | null
}

type PresenceAction =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "reset"; canUseRealtime: boolean }
  | { type: "resolved"; presence: RealtimePlayerPresence | null }

function presenceReducer(
  state: PresenceState,
  action: PresenceAction
): PresenceState {
  switch (action.type) {
    case "connected":
      return {
        ...state,
        isConnected: true,
      }
    case "disconnected":
      return {
        ...state,
        isConnected: false,
      }
    case "reset":
      return {
        hasResolved: !action.canUseRealtime,
        isConnected: false,
        presence: null,
      }
    case "resolved":
      return {
        ...state,
        hasResolved: true,
        presence: action.presence,
      }
    default:
      return state
  }
}

export function useRealtimePlayerPresence(
  steamId: string | null | undefined,
  enabled = true
) {
  const [state, dispatch] = useReducer(presenceReducer, {
    hasResolved: false,
    isConnected: false,
    presence: null,
  })
  const normalizedSteamId = steamId?.trim() ?? ""
  const canUseRealtime =
    enabled && isRealtimeEnabled() && normalizedSteamId.length > 0

  useEffect(() => {
    dispatch({
      type: "reset",
      canUseRealtime,
    })

    if (!canUseRealtime) {
      return
    }

    const socket = getRealtimeSocket()
    let cancelled = false

    const hydratePresence = async () => {
      try {
        const nextPresence =
          await fetchRealtimePlayerPresence(normalizedSteamId)
        if (cancelled) {
          return
        }

        dispatch({
          type: "resolved",
          presence: nextPresence,
        })
      } catch (error) {
        void appendRealtimeLog("realtime.presence.hydrate.error", {
          steamId: normalizedSteamId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    if (!socket) {
      void hydratePresence()
      return () => {
        cancelled = true
      }
    }

    const handleConnect = () => {
      dispatch({
        type: "connected",
      })
      void appendRealtimeLog("realtime.presence.socket.connected", {
        steamId: normalizedSteamId,
      })
      socket.emit("presence:subscribe", {
        steamId: normalizedSteamId,
      })
    }
    const handleDisconnect = () => {
      dispatch({
        type: "disconnected",
      })
      void appendRealtimeLog("realtime.presence.socket.disconnected", {
        steamId: normalizedSteamId,
      })
    }
    const handleConnectError = (error: Error) => {
      void appendRealtimeLog("realtime.presence.socket.connect_error", {
        steamId: normalizedSteamId,
        error: error.message,
      })
    }
    const handlePresence = (payload: PlayerPresencePayload) => {
      if (payload.steamId !== normalizedSteamId) {
        return
      }

      dispatch({
        type: "resolved",
        presence: payload.presence,
      })
    }

    socket.on("connect", handleConnect)
    socket.on("disconnect", handleDisconnect)
    socket.on("connect_error", handleConnectError)
    socket.on("player:presence", handlePresence)

    if (!socket.connected) {
      socket.connect()
    } else {
      handleConnect()
    }

    void hydratePresence()

    return () => {
      cancelled = true
      socket.emit("presence:unsubscribe", {
        steamId: normalizedSteamId,
      })
      socket.off("connect", handleConnect)
      socket.off("disconnect", handleDisconnect)
      socket.off("connect_error", handleConnectError)
      socket.off("player:presence", handlePresence)
    }
  }, [canUseRealtime, normalizedSteamId])

  return {
    hasResolved: state.hasResolved,
    isConnected: state.isConnected,
    presence: state.presence,
  }
}
