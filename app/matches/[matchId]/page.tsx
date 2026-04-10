import type { Metadata } from "next"

import { PickupMatchPageClient } from "@/components/pages/pickup-match-page-client"
import { getPublicPickupMatchDetail } from "@/lib/server/public-seo"
import { createMatchMetadata, createPageMetadata } from "@/lib/seo"

export const runtime = "nodejs"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>
}): Promise<Metadata> {
  const { matchId } = await params
  const normalizedMatchId = typeof matchId === "string" ? matchId : null

  if (!normalizedMatchId) {
    return createPageMetadata({
      title: "Match",
      path: "/matches",
      description: "Public QLTracker pickup match detail.",
    })
  }

  const initialData = await getPublicPickupMatchDetail(normalizedMatchId)
  if (!initialData) {
    return createPageMetadata({
      title: "Match",
      path: `/matches/${normalizedMatchId}`,
      description: "Public QLTracker pickup match detail.",
    })
  }

  const title = `${initialData.match.queue.name} Match`
  const description = [
    initialData.match.finalMapKey
      ? `Map: ${initialData.match.finalMapKey}.`
      : null,
    initialData.match.finalScore
      ? `Score: ${initialData.match.finalScore}.`
      : null,
    `Queue: ${initialData.match.queue.name}.`,
  ]
    .filter(Boolean)
    .join(" ")

  return createMatchMetadata({
    title,
    path: `/matches/${initialData.match.id}`,
    description,
  })
}

export default async function MatchRoutePage({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  const normalizedMatchId = typeof matchId === "string" ? matchId : null
  const initialData =
    normalizedMatchId == null
      ? undefined
      : ((await getPublicPickupMatchDetail(normalizedMatchId)) ?? undefined)

  return (
    <PickupMatchPageClient
      initialData={initialData}
      matchId={normalizedMatchId}
    />
  )
}
