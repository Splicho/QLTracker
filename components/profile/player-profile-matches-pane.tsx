import { Leaderboard } from "@/components/icon";
import { RecentMatchRow } from "@/components/profile/recent-match-row";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { PickupPlayerProfile } from "@/lib/pickup";

export function PlayerProfileMatchesPane({
  onOpenMatch,
  profile,
}: {
  onOpenMatch: (matchId: string) => void;
  profile: PickupPlayerProfile;
}) {
  if (profile.recentMatches.length === 0) {
    return (
      <div className="min-h-0 flex-1 data-[state=inactive]:hidden">
        <div className="px-4 py-6">
          <Empty className="min-h-[280px] border border-dashed border-border bg-muted/20">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Leaderboard className="size-5" />
              </EmptyMedia>
              <EmptyTitle>No match history yet</EmptyTitle>
              <EmptyDescription>
                Completed pickup matches will show up here once this player has
                recorded results.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 data-[state=inactive]:hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-foreground">Match history</p>
      </div>
      <div className="divide-y divide-border">
        {profile.recentMatches.map((match) => (
          <RecentMatchRow
            key={match.id}
            match={match}
            onClick={() => onOpenMatch(match.id)}
            trailingContent="rating-delta"
          />
        ))}
      </div>
    </div>
  );
}
