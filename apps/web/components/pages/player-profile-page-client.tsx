"use client"

import { useRouter } from "next/navigation"
import { PlayerProfilePage } from "@/components/pages/player-profile-page"
import { useLiveServers } from "@/hooks/use-live-servers"
import { usePickupAuth } from "@/hooks/use-pickup-auth"
import { useServerInteractions } from "@/hooks/use-server-interactions"
import type { PickupPlayerProfile } from "@/lib/pickup"

export function PlayerProfilePageClient({
  initialData,
  playerId,
}: {
  initialData?: PickupPlayerProfile
  playerId: string | null
}) {
  const router = useRouter()
  const auth = usePickupAuth()
  const { servers } = useLiveServers()
  const interactions = useServerInteractions({})

  return (
    <>
      <PlayerProfilePage
        currentPlayerId={auth.player?.id ?? null}
        initialData={initialData}
        onOpenMatch={(matchId) => router.push(`/matches/${matchId}`)}
        onOpenServer={interactions.openServerDetails}
        playerId={playerId}
        sessionToken={auth.sessionToken}
        servers={servers}
      />
      {interactions.overlays}
    </>
  )
}
