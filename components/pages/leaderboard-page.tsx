import type { PickupLeaderboards } from "@/lib/pickup"
import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AnimatePresence, motion } from "framer-motion"
import { Trophy } from "lucide-react"
import { PlayerName } from "@/components/pickup/player-name"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  fetchPickupLeaderboards,
  fetchPickupPlayerProfile,
  isPickupApiConfigured,
  type PickupLeaderboardQueue,
} from "@/lib/pickup"
function getTrophyTone(rank: number) {
  if (rank === 1) {
    return "text-amber-400"
  }

  if (rank === 2) {
    return "text-zinc-300"
  }

  if (rank === 3) {
    return "text-orange-500"
  }

  return "text-muted-foreground"
}

function formatWinRate(value: number | null) {
  return value == null ? "-" : `${value}%`
}

const leaderboardLayoutTransition = {
  layout: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1] as const,
  },
}

const leaderboardRowTransition = {
  layout: {
    duration: 0.3,
    ease: [0.25, 0.1, 0.25, 1] as const,
  },
  opacity: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  scale: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] as const,
  },
  y: {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] as const,
  },
}

function LeaderboardTable({
  onOpenPlayerProfile,
  onPrefetchPlayerProfile,
  queue,
}: {
  onOpenPlayerProfile: (playerId: string) => void
  onPrefetchPlayerProfile: (playerId: string) => void
  queue: PickupLeaderboardQueue
}) {
  if (queue.entries.length === 0) {
    return (
      <div className="flex min-h-[22rem] items-center justify-center px-6 text-center">
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            No rated players yet
          </p>
          <p className="text-sm text-muted-foreground">
            {queue.queue.name} has an active season, but no leaderboard entries
            yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Table containerClassName="overflow-x-clip overflow-y-visible">
      <TableHeader>
        <TableRow className="border-b border-border hover:bg-transparent">
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Rank
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Player
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Rating
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Played
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            W
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            L
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Win Rate
          </TableHead>
          <TableHead className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase">
            Season
          </TableHead>
        </TableRow>
      </TableHeader>
      <motion.tbody
        layout
        className="[&_tr:last-child]:border-0"
        transition={leaderboardLayoutTransition}
      >
        <AnimatePresence initial={false}>
          {queue.entries.map((entry) => (
            <motion.tr
              key={entry.player.id}
              layout="position"
              initial={{ opacity: 0, y: 8, scale: 0.995 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.995 }}
              transition={leaderboardRowTransition}
              className="h-12 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-muted/35"
              onClick={() => onOpenPlayerProfile(entry.player.steamId)}
              onFocus={() => onPrefetchPlayerProfile(entry.player.steamId)}
              onMouseEnter={() => onPrefetchPlayerProfile(entry.player.steamId)}
              onPointerDown={() =>
                onPrefetchPlayerProfile(entry.player.steamId)
              }
            >
              <TableCell className="h-12 px-4 py-0 align-middle">
                <div className="flex items-center text-sm font-medium text-foreground">
                  {entry.rank <= 3 ? (
                    <Trophy
                      className={`size-3.5 ${getTrophyTone(entry.rank)}`}
                    />
                  ) : (
                    <span>{entry.rank}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <div className="min-w-0 text-sm font-medium text-foreground">
                  <div className="inline-flex max-w-full items-center gap-2 truncate text-left">
                    <PlayerName
                      country
                      countryCode={entry.player.countryCode}
                      fallbackClassName="inline-block max-w-full truncate align-bottom"
                      personaName={entry.player.personaName}
                    />
                  </div>
                </div>
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm font-semibold text-foreground">
                {entry.rating}
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm text-foreground">
                {entry.gamesPlayed}
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm text-foreground">
                {entry.wins}
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm text-foreground">
                {entry.losses}
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm text-foreground">
                {formatWinRate(entry.winRate)}
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle text-sm text-muted-foreground">
                {queue.season.name}
              </TableCell>
            </motion.tr>
          ))}
        </AnimatePresence>
      </motion.tbody>
    </Table>
  )
}

function LeaderboardLoading() {
  return (
    <div className="min-h-0 flex-1">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
      <Table containerClassName="overflow-x-clip overflow-y-visible">
        <TableHeader>
          <TableRow className="border-b border-border hover:bg-transparent">
            {Array.from({ length: 8 }).map((_, index) => (
              <TableHead
                key={`leaderboard-loading-head-${index}`}
                className="h-10 px-4 text-xs tracking-[0.12em] text-muted-foreground uppercase"
              >
                <Skeleton className="h-3 w-16 rounded-sm" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, index) => (
            <TableRow
              key={`leaderboard-loading-row-${index}`}
              className="h-12 border-b border-border hover:bg-transparent"
            >
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-10 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-40 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-10 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-10 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-8 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-8 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-14 rounded-sm" />
              </TableCell>
              <TableCell className="h-12 px-4 py-0 align-middle">
                <Skeleton className="h-4 w-24 rounded-sm" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function LeaderboardPage({
  initialData,
  initialQueueId = null,
  onOpenPlayerProfile,
}: {
  initialData?: PickupLeaderboards
  initialQueueId?: string | null
  onOpenPlayerProfile: (playerId: string) => void
}) {
  const queryClient = useQueryClient()
  const [preferredQueueId, setPreferredQueueId] = useState<string | null>(null)
  const leaderboardsQuery = useQuery({
    queryKey: ["pickup", "leaderboards"],
    queryFn: fetchPickupLeaderboards,
    enabled: isPickupApiConfigured(),
    initialData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const queues = leaderboardsQuery.data?.queues ?? []
  const selectedQueueId = queues.some(
    (queue) => queue.queue.id === preferredQueueId
  )
    ? preferredQueueId
    : initialQueueId &&
        queues.some((queue) => queue.queue.id === initialQueueId)
      ? initialQueueId
      : (queues[0]?.queue.id ?? null)
  const selectedQueue =
    queues.find((queue) => queue.queue.id === selectedQueueId) ??
    queues[0] ??
    null
  const activeQueueId = selectedQueue?.queue.id ?? ""
  const prefetchPlayerProfile = (playerId: string) => {
    if (!isPickupApiConfigured()) {
      return
    }

    void queryClient.prefetchQuery({
      queryKey: ["pickup", "player-profile", playerId],
      queryFn: () => fetchPickupPlayerProfile(playerId),
      staleTime: 30_000,
    })
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-x-clip">
      {leaderboardsQuery.isPending ? (
        <LeaderboardLoading />
      ) : !isPickupApiConfigured() ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">
              Leaderboards are unavailable
            </p>
            <p className="text-sm text-muted-foreground">
              Set <code className="font-mono">VITE_PICKUP_API_URL</code> to load
              competitive standings.
            </p>
          </div>
        </div>
      ) : leaderboardsQuery.isError ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">
              Leaderboards could not be loaded
            </p>
            <p className="text-sm text-muted-foreground">
              {leaderboardsQuery.error instanceof Error
                ? leaderboardsQuery.error.message
                : "Unexpected leaderboard error."}
            </p>
          </div>
        </div>
      ) : queues.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center">
          <div className="space-y-2">
            <p className="text-base font-medium text-foreground">
              No leaderboards yet
            </p>
            <p className="text-sm text-muted-foreground">
              Active pickup seasons will show up here once standings are
              available.
            </p>
          </div>
        </div>
      ) : (
        <Tabs
          value={activeQueueId}
          onValueChange={setPreferredQueueId}
          className="min-h-0 flex-1 gap-0"
        >
          <div className="sticky top-0 z-20 border-b border-border bg-background">
            <div className="flex min-h-14 items-center px-4">
              <TabsList
                variant="line"
                className="h-auto gap-1 bg-transparent p-0"
              >
                {queues.map((queue) => (
                  <TabsTrigger
                    key={queue.queue.id}
                    value={queue.queue.id}
                    className="h-14 rounded-none px-3 text-sm font-medium after:bg-primary group-data-[orientation=horizontal]/tabs:after:bottom-[-1px]"
                  >
                    {queue.queue.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>
          {selectedQueue ? (
            <div className="min-h-0 flex-1">
              <LeaderboardTable
                onOpenPlayerProfile={onOpenPlayerProfile}
                onPrefetchPlayerProfile={prefetchPlayerProfile}
                queue={selectedQueue}
              />
            </div>
          ) : null}
        </Tabs>
      )}
    </section>
  )
}
