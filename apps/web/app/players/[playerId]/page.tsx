import type { Metadata } from "next"
import Script from "next/script"

import { PlayerProfilePageClient } from "@/components/pages/player-profile-page-client"
import { stripQuakeColors } from "@/lib/quake"
import { getPublicPickupPlayerProfile } from "@/lib/server/public-seo"
import {
  createPageMetadata,
  createPlayerMetadata,
  resolveAbsoluteUrl,
  siteConfig,
} from "@/lib/seo"

export const runtime = "nodejs"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ playerId: string }>
}): Promise<Metadata> {
  const { playerId } = await params
  const normalizedPlayerId = typeof playerId === "string" ? playerId : null

  if (!normalizedPlayerId) {
    return createPageMetadata({
      title: "Player Profile",
      path: "/players",
      description: "Public QLTracker pickup player profile.",
    })
  }

  const profile = await getPublicPickupPlayerProfile(normalizedPlayerId)
  if (!profile) {
    return createPageMetadata({
      title: "Player Profile",
      path: `/players/${normalizedPlayerId}`,
      description: "Public QLTracker pickup player profile.",
    })
  }

  const strippedPersonaName =
    stripQuakeColors(profile.player.personaName).trim() || "Player"
  const bestRating = profile.ratings[0]
  const descriptionParts = [
    `${strippedPersonaName}'s QLTracker pickup profile.`,
    bestRating
      ? `${bestRating.queueName}: ${bestRating.displayRating} rating.`
      : null,
    profile.stats.winRate != null
      ? `${profile.stats.winRate}% win rate over ${profile.stats.totalMatches} matches.`
      : null,
  ].filter(Boolean)

  return createPlayerMetadata({
    title: strippedPersonaName,
    path: `/players/${profile.player.steamId}`,
    description: descriptionParts.join(" "),
  })
}

export default async function PlayerRoutePage({
  params,
}: {
  params: Promise<{ playerId: string }>
}) {
  const { playerId } = await params
  const normalizedPlayerId = typeof playerId === "string" ? playerId : null
  const initialData =
    normalizedPlayerId == null
      ? undefined
      : ((await getPublicPickupPlayerProfile(normalizedPlayerId)) ?? undefined)

  const profileJsonLd =
    initialData == null
      ? null
      : (() => {
          const strippedPersonaName =
            stripQuakeColors(initialData.player.personaName).trim() || "Player"

          return {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            mainEntity: {
              "@type": "Person",
              image: initialData.player.avatarUrl
                ? [resolveAbsoluteUrl(initialData.player.avatarUrl)]
                : [resolveAbsoluteUrl(siteConfig.ogImage.url)],
              name: strippedPersonaName,
              sameAs: initialData.player.profileUrl ?? undefined,
              url: resolveAbsoluteUrl(`/players/${initialData.player.steamId}`),
            },
            name: `${strippedPersonaName} Pickup Profile`,
            url: resolveAbsoluteUrl(`/players/${initialData.player.steamId}`),
          }
        })()
  const profileJsonLdId =
    initialData == null
      ? null
      : `pickup-player-jsonld-${initialData.player.steamId}`

  return (
    <>
      {profileJsonLd && profileJsonLdId ? (
        <Script id={profileJsonLdId} type="application/ld+json">
          {JSON.stringify(profileJsonLd)}
        </Script>
      ) : null}
      <PlayerProfilePageClient
        initialData={initialData}
        playerId={normalizedPlayerId}
      />
    </>
  )
}
