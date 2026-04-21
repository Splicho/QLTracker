"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PickupPage } from "@/components/pages/pickup-page"
import { usePickupAuth } from "@/hooks/use-pickup-auth"
import { usePickupState } from "@/hooks/use-pickup-state"
import { fetchPickupLandingData, type PickupLandingData } from "@/lib/pickup"
import { getRealtimeSocket, isRealtimeEnabled } from "@/lib/realtime"
import type { InitialPickupBrowserState } from "@/lib/server/pickup-browser"

export function PickupPageClient({
  initialPickupState,
  initialLandingData,
}: {
  initialPickupState?: InitialPickupBrowserState
  initialLandingData?: PickupLandingData
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const auth = usePickupAuth(
    initialPickupState
      ? {
          activeLock: initialPickupState.activeLock,
          player: initialPickupState.player,
          rating: initialPickupState.rating,
          ratings: initialPickupState.ratings,
          sessionToken: initialPickupState.sessionToken,
        }
      : undefined
  )
  const pickup = usePickupState(
    auth.sessionToken,
    true,
    auth.player,
    initialPickupState?.publicState ?? null,
    initialPickupState?.playerState ?? null
  )
  const landingQuery = useQuery({
    queryKey: ["pickup", "landing"],
    queryFn: fetchPickupLandingData,
    initialData: initialLandingData,
    staleTime: 15_000,
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (!isRealtimeEnabled()) {
      return
    }

    const socket = getRealtimeSocket()
    if (!socket) {
      return
    }

    const refetchLanding = () => {
      void queryClient.invalidateQueries({
        queryKey: ["pickup", "landing"],
      })
    }

    socket.on("connect", refetchLanding)
    socket.on("pickup:public-state", refetchLanding)
    socket.on("pickup:state", refetchLanding)
    socket.on("pickup:match-detail:update", refetchLanding)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off("connect", refetchLanding)
      socket.off("pickup:public-state", refetchLanding)
      socket.off("pickup:state", refetchLanding)
      socket.off("pickup:match-detail:update", refetchLanding)
    }
  }, [queryClient])

  return (
    <PickupPage
      activeLock={auth.activeLock}
      guestMode={auth.guestMode}
      liveMatches={landingQuery.data?.liveMatches ?? []}
      mockMode={pickup.mockMode}
      mockStage={pickup.mockStage}
      onCancelSubstituteRequest={pickup.cancelSubstituteRequest}
      onConnectWithSteam={auth.connectWithSteam}
      onJoinQueue={pickup.joinQueue}
      onOpenMatch={(matchId) => router.push(`/matches/${matchId}`)}
      onOpenPlayerProfile={(playerId) => router.push(`/players/${playerId}`)}
      onRequestSubstitute={pickup.requestSubstitute}
      onRespondToSubstituteRequest={pickup.respondToSubstituteRequest}
      onSetMockStage={pickup.setMockStage}
      onVetoBan={pickup.vetoBan}
      pickupAvailable={auth.pickupAvailable}
      player={auth.player}
      playerState={pickup.playerState}
      publicState={pickup.publicState}
      recentMatches={landingQuery.data?.recentMatches ?? []}
      userLoading={auth.userLoading}
    />
  )
}
