"use client"

import NumberFlow from "@number-flow/react"
import { ArrowLeft } from "lucide-react"
import { useEffect, useState } from "react"
import { Medal } from "@/components/icon"
import { PickupRankBadge } from "@/components/pickup/pickup-rank-badge"
import { RecentMatchRow } from "@/components/profile/recent-match-row"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { PickupPlayerProfile, PickupSeasonalRating } from "@/lib/pickup"

function formatWinRate(value: number | null) {
  if (value == null) {
    return "-"
  }

  return `${Math.round(value)}%`
}

function getRoundedWinRate(value: number | null) {
  if (value == null) {
    return null
  }

  return Math.round(value)
}

function getHighestRating(ratings: PickupSeasonalRating[]) {
  if (ratings.length === 0) {
    return null
  }

  return ratings.reduce((best, current) =>
    current.displayRating > best.displayRating ? current : best
  )
}

function getHighestPlacedRating(ratings: PickupSeasonalRating[]) {
  const placedRatings = ratings.filter((rating) => rating.isPlaced && rating.rank)

  if (placedRatings.length === 0) {
    return null
  }

  return placedRatings.reduce((best, current) =>
    current.displayRating > best.displayRating ? current : best
  )
}

export function PlayerProfileOverviewPane({
  onOpenMatch,
  profile,
  onOpenMatches,
}: {
  onOpenMatch: (matchId: string) => void
  profile: PickupPlayerProfile
  onOpenMatches: () => void
}) {
  const highestRating = getHighestRating(profile.ratings)
  const highestPlacedRating = getHighestPlacedRating(profile.ratings)
  const roundedWinRate = getRoundedWinRate(profile.stats.winRate)
  const [hasEntered, setHasEntered] = useState(false)
  const hasOverviewData =
    profile.stats.totalMatches > 0 ||
    profile.ratings.length > 0 ||
    profile.recentMatches.length > 0

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setHasEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [profile.player.id])

  if (!hasOverviewData) {
    return (
      <div className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <div className="px-4 py-6">
          <Empty className="min-h-[320px] border border-dashed border-border bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Medal className="size-5 text-amber-400" />
              </EmptyMedia>
              <EmptyTitle>No overview yet</EmptyTitle>
              <EmptyDescription>
                This player has not completed any recorded pickup matches yet.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 data-[state=inactive]:hidden">
      <div className="border-b border-border">
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-5">
          <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Matches
            </p>
            <NumberFlow
              className="mt-1 text-2xl font-semibold text-foreground"
              value={hasEntered ? profile.stats.totalMatches : 0}
            />
          </div>
          <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Wins
            </p>
            <NumberFlow
              className="mt-1 text-2xl font-semibold text-foreground"
              value={hasEntered ? profile.stats.wins : 0}
            />
          </div>
          <div className="px-4 py-4 sm:border-r">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Win Rate
            </p>
            {roundedWinRate == null ? (
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {formatWinRate(profile.stats.winRate)}
              </p>
            ) : (
              <NumberFlow
                className="mt-1 text-2xl font-semibold text-foreground"
                suffix="%"
                value={hasEntered ? roundedWinRate : 0}
              />
            )}
          </div>
          <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Peak Rating
            </p>
            {highestRating ? (
              <NumberFlow
                className="mt-1 text-2xl font-semibold text-foreground"
                value={hasEntered ? highestRating.displayRating : 0}
              />
            ) : (
              <p className="mt-1 text-2xl font-semibold text-foreground">-</p>
            )}
          </div>
          <div className="px-4 py-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Rating
            </p>
            {highestPlacedRating?.rank ? (
              <Badge
                className="mt-1 h-8 max-w-full gap-1.5 rounded-md border-border/70 bg-muted px-2 text-sm font-semibold text-foreground"
                variant="outline"
              >
                <PickupRankBadge
                  imageClassName="size-5"
                  rank={highestPlacedRating.rank}
                  showTitle
                />
              </Badge>
            ) : highestRating ? (
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Unranked {highestRating.placementGamesPlayed}/
                {highestRating.placementGamesRequired}
              </p>
            ) : (
              <p className="mt-1 text-2xl font-semibold text-foreground">-</p>
            )}
          </div>
        </div>
      </div>
      <div className="border-b border-border px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {profile.ratings.length > 0 ? (
            profile.ratings.map((rating) => (
              <Badge
                key={`${rating.seasonId}:${rating.queueId}`}
                className="h-8 gap-1.5 rounded-md border-border/70 bg-muted pr-1 pl-2 text-xs font-medium text-foreground"
                variant="outline"
              >
                <span className="text-foreground/70">{rating.queueName}</span>
                <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-border/70 bg-background px-1.5 text-foreground/80">
                  <PickupRankBadge
                    imageClassName="size-3.5 rounded-xs"
                    rank={rating.rank}
                    tooltip={`${rating.queueName}: ${rating.rank?.title ?? "Unranked"}`}
                  />
                  {rating.isPlaced
                    ? (rating.rank?.title ?? "Unranked")
                    : `Unranked ${rating.placementGamesPlayed}/${rating.placementGamesRequired}`}
                </span>
                <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-border/70 bg-background px-1.5 font-semibold text-foreground">
                  <Medal className="size-3 text-amber-400" />
                  {rating.displayRating}
                </span>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No active ratings yet.
            </p>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">Recent matches</p>
          <Button
            className="h-8 rounded-md px-3 text-xs font-medium"
            onClick={onOpenMatches}
            size="sm"
            type="button"
            variant="outline"
          >
            View full history
            <ArrowLeft className="size-4 rotate-180" />
          </Button>
        </div>
        {profile.recentMatches.length > 0 ? (
          <div className="divide-y divide-border">
            {profile.recentMatches.slice(0, 10).map((match) => (
              <RecentMatchRow
                key={match.id}
                match={match}
                onClick={() => onOpenMatch(match.id)}
                trailingContent="rating-delta"
              />
            ))}
          </div>
        ) : (
          <div className="px-4 py-6">
            <Empty className="min-h-[220px] border border-dashed border-border bg-muted/20">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Medal className="size-5 text-amber-400" />
                </EmptyMedia>
                <EmptyTitle>No recent matches yet</EmptyTitle>
                <EmptyDescription>
                  Completed pickup matches will appear here once this player has
                  a recorded history.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </div>
  )
}
