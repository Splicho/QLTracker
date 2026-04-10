import { ArrowLeft } from "lucide-react"
import { Medal } from "@/components/icon"
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

function getHighestRating(ratings: PickupSeasonalRating[]) {
  if (ratings.length === 0) {
    return null
  }

  return ratings.reduce((best, current) =>
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
  const hasOverviewData =
    profile.stats.totalMatches > 0 ||
    profile.ratings.length > 0 ||
    profile.recentMatches.length > 0

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
        <div className="grid grid-cols-2 gap-0 sm:grid-cols-4">
          <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Matches
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {profile.stats.totalMatches}
            </p>
          </div>
          <div className="border-b border-border px-4 py-4 sm:border-r sm:border-b-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Wins
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {profile.stats.wins}
            </p>
          </div>
          <div className="px-4 py-4 sm:border-r">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Win Rate
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatWinRate(profile.stats.winRate)}
            </p>
          </div>
          <div className="px-4 py-4">
            <p className="text-[11px] font-medium text-muted-foreground uppercase">
              Peak Rating
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {highestRating?.displayRating ?? "-"}
            </p>
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
