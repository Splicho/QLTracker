import { Medal } from "@/components/icon";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PickupPlayerProfile } from "@/lib/pickup";

function formatWinRate(value: number | null) {
  if (value == null) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

export function PlayerProfileStatsPane({
  profile,
}: {
  profile: PickupPlayerProfile;
}) {
  return (
    <div className="min-h-0 flex-1 data-[state=inactive]:hidden">
      {/* TODO: Extend provisioner/profile APIs with combat stats such as kills, deaths,
          K/D, damage, and weapon breakdowns, then render them in this pane. */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Seasonal stats</p>
      </div>
      {profile.ratings.length > 0 ? (
        <div className="divide-y divide-border">
          <div className="grid grid-cols-[minmax(0,1.4fr)_96px_88px_72px_72px_88px] gap-4 border-b border-border px-4 py-3 text-[11px] font-medium uppercase text-muted-foreground">
            <span>Queue</span>
            <span>Rating</span>
            <span>Played</span>
            <span>W</span>
            <span>L</span>
            <span>Win Rate</span>
          </div>
          {profile.ratings.map((rating) => (
            <div
              key={`${rating.seasonId}:${rating.queueId}`}
              className="grid grid-cols-[minmax(0,1.4fr)_96px_88px_72px_72px_88px] items-center gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {rating.queueName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {rating.seasonName}
                </p>
              </div>
              <div>
                <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-border/70 bg-background px-1.5 text-sm font-semibold text-foreground">
                  <Medal className="size-3 text-amber-400" />
                  {rating.displayRating}
                </span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {rating.gamesPlayed}
              </span>
              <span className="text-sm font-medium text-foreground">
                {rating.wins}
              </span>
              <span className="text-sm font-medium text-foreground">
                {rating.losses}
              </span>
              <span className="text-sm font-medium text-foreground">
                {formatWinRate(
                  rating.gamesPlayed > 0
                    ? (rating.wins / rating.gamesPlayed) * 100
                    : null
                )}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6">
          <Empty className="min-h-[280px] border border-dashed border-border bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Medal className="size-5 text-amber-400" />
              </EmptyMedia>
              <EmptyTitle>No seasonal stats yet</EmptyTitle>
              <EmptyDescription>
                Seasonal ratings and per-queue performance will show up here
                once this player has recorded pickup results.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </div>
  );
}
