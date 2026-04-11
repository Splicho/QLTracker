import type { Metadata } from "next"
import { FavoritesPageClient } from "@/components/pages/favorites-page-client"
import { createPageMetadata } from "@/lib/seo"

export const metadata: Metadata = createPageMetadata({
  title: "Favorites",
  path: "/favorites",
  description:
    "Track your favorite Quake Live servers on QLTracker and see live player counts across the servers you care about most.",
})

export default function FavoritesRoutePage() {
  return <FavoritesPageClient />
}
