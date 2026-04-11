"use client"

import { useRouter } from "next/navigation"
import { LeaderboardPage } from "@/components/pages/leaderboard-page"
import type { PickupLeaderboards } from "@/lib/pickup"

export function LeaderboardsPageClient({
  initialData,
}: {
  initialData: PickupLeaderboards
}) {
  const router = useRouter()

  return (
    <LeaderboardPage
      initialData={initialData}
      onOpenPlayerProfile={(playerId) => router.push(`/players/${playerId}`)}
    />
  )
}
