import { Medal } from "@/components/icon"
import { RecentMatchRow } from "@/components/profile/recent-match-row"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { PickupProfileMatch } from "@/lib/pickup"

export function PickupRecentMatches({
  matches,
  onOpenMatch,
}: {
  matches: PickupProfileMatch[]
  onOpenMatch: (matchId: string) => void
}) {
  return (
    <section className="border-t border-border">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium text-foreground">Recent matches</h2>
      </div>
      {matches.length > 0 ? (
        <div className="divide-y divide-border">
          {matches.map((match) => (
            <RecentMatchRow
              key={match.id}
              match={match}
              onClick={() => onOpenMatch(match.id)}
              trailingContent="date"
            />
          ))}
        </div>
      ) : (
        <div className="px-6 py-6">
          <Empty className="border border-dashed border-border bg-muted/10">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Medal />
              </EmptyMedia>
              <EmptyTitle>No recent matches yet</EmptyTitle>
              <EmptyDescription>
                Completed pickup matches will show up here once the recent match
                feed is wired.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
    </section>
  )
}
