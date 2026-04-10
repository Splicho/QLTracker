import type { Metadata } from "next"
import { PickupPageClient } from "@/components/pages/pickup-page-client"
import { getInitialPickupBrowserState } from "@/lib/server/pickup-browser"
import { getPickupLandingData } from "@/lib/server/pickup"
import { createPageMetadata } from "@/lib/seo"

export const runtime = "nodejs"
export const metadata: Metadata = createPageMetadata({
  title: "Pickup",
  path: "/pickup",
  description:
    "Join live QLTracker pickup queues, track active matches, and follow the latest completed Quake Live pickup games.",
})

export default async function PickupRoutePage() {
  const [initialLandingData, initialPickupState] = await Promise.all([
    getPickupLandingData(),
    getInitialPickupBrowserState({ includePublicStateForGuests: true }),
  ])

  return (
    <PickupPageClient
      initialPickupState={initialPickupState}
      initialLandingData={initialLandingData}
    />
  )
}
