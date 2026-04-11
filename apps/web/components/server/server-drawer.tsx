import { Fragment, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ArrowUpDown,
  ArrowUpRight,
  Eye,
  UserMinus,
  UserPlus,
} from "lucide-react"
import { format, formatDistanceToNowStrict, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Lock, Medal, Play, SlashCircle, Unlock } from "@/components/icon"
import { PlayerName } from "@/components/pickup/player-name"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Drawer, DrawerContent } from "@/components/ui/drawer"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTrackedPlayers } from "@/hooks/use-tracked-players"
import { getMapEntry } from "@/lib/maps"
import { openExternalUrl } from "@/lib/open-url"
import { stripQuakeColors } from "@/lib/quake"
import {
  fetchRealtimeServerHistory,
  isRealtimeEnabled,
  type ServerHistoryPoint,
} from "@/lib/realtime"
import { getGameModeLabel } from "@/lib/server-utils"
import {
  fetchSteamServerPlayerRatings,
  fetchSteamServerPlayers,
  type ServerPlayerRating,
  type SteamServer,
} from "@/lib/steam"
import { formatDurationHoursMinutes } from "@/lib/time"

function normalizePlayerName(name: string) {
  return name
    .replace(/\^[0-9]/g, "")
    .trim()
    .toLowerCase()
}

function calculateAverage(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => value != null)

  if (numbers.length === 0) {
    return null
  }

  return Math.round(
    numbers.reduce((total, value) => total + value, 0) / numbers.length
  )
}

function calculateHighestRatedPlayer(
  players: ServerPlayerRating[],
  ratingKey: "qelo" | "trueskill"
) {
  return players.reduce<ServerPlayerRating | null>((highest, player) => {
    const rating = player[ratingKey]

    if (rating == null) {
      return highest
    }

    if (highest == null) {
      return player
    }

    return rating > (highest[ratingKey] ?? Number.NEGATIVE_INFINITY)
      ? player
      : highest
  }, null)
}

function getQlStatsPlayerProfileUrl(steamId: string) {
  return `https://qlstats.net/player/${steamId}`
}

function getTeamScoreSummary(server: SteamServer) {
  const redPlayers = server.players_info.filter((player) => player.team === 1)
  const bluePlayers = server.players_info.filter((player) => player.team === 2)

  if (redPlayers.length === 0 && bluePlayers.length === 0) {
    return null
  }

  return {
    blue: bluePlayers.reduce((total, player) => total + player.score, 0),
    red: redPlayers.reduce((total, player) => total + player.score, 0),
  }
}

const playerTeamSectionMeta = {
  blue: {
    labelKey: "serverList.drawer.teams.blue",
    toneClassName: "text-sky-400",
  },
  free: {
    labelKey: "serverList.drawer.teams.free",
    toneClassName: "text-foreground",
  },
  players: {
    labelKey: "serverList.drawer.teams.players",
    toneClassName: "text-foreground",
  },
  red: {
    labelKey: "serverList.drawer.teams.red",
    toneClassName: "text-rose-400",
  },
  spectators: {
    labelKey: "serverList.drawer.teams.spectators",
    toneClassName: "text-muted-foreground",
  },
  unassigned: {
    labelKey: "serverList.drawer.teams.unassigned",
    toneClassName: "text-muted-foreground",
  },
} as const

type PlayerTeamSectionKey = keyof typeof playerTeamSectionMeta

type DrawerPlayer = SteamServer["players_info"][number] & {
  rating: ServerPlayerRating | null
}

function getPlayerTeamSectionKey(
  team: number | null | undefined,
  hasRedBlueTeams: boolean
): PlayerTeamSectionKey {
  if (team === 1) {
    return "red"
  }

  if (team === 2) {
    return "blue"
  }

  if (team === 3) {
    return "spectators"
  }

  if (team === 0) {
    return hasRedBlueTeams ? "free" : "players"
  }

  return "unassigned"
}

function ServerAverageRatingBadges({
  serverAddress,
}: {
  serverAddress: string
}) {
  const { t } = useTranslation()
  const ratingsQuery = useQuery({
    queryKey: ["steam", "server", "player-ratings", serverAddress],
    queryFn: () => fetchSteamServerPlayerRatings(serverAddress),
    staleTime: 10_000,
  })
  const ratings = useMemo(() => ratingsQuery.data ?? [], [ratingsQuery.data])

  const averageQelo = useMemo(
    () => calculateAverage(ratings.map((player) => player.qelo)),
    [ratings]
  )
  const averageTrueskill = useMemo(
    () => calculateAverage(ratings.map((player) => player.trueskill)),
    [ratings]
  )
  const highestQeloPlayer = useMemo(
    () => calculateHighestRatedPlayer(ratings, "qelo"),
    [ratings]
  )
  const highestTrueskillPlayer = useMemo(
    () => calculateHighestRatedPlayer(ratings, "trueskill"),
    [ratings]
  )
  const isPending =
    ratingsQuery.isPending ||
    (ratingsQuery.fetchStatus === "fetching" && !ratingsQuery.data)
  const badgeClassName =
    "rounded-md pl-2 pr-1 py-1 text-[11px] font-medium tracking-[0.01em]"

  if (isPending) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
        <Separator orientation="vertical" className="h-7" />
        <Skeleton className="h-7 w-36 rounded-md" />
        <Skeleton className="h-7 w-36 rounded-md" />
      </div>
    )
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={badgeClassName}>
            <SlashCircle className="size-3" />
            QElo {"\u00b7"}
            <div className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground">
              {averageQelo ?? "-"}
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("serverList.drawer.avgQeloTooltip")}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={badgeClassName}>
            <SlashCircle className="size-3" />
            TSkill {"\u00b7"}
            <div className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground">
              {averageTrueskill ?? "-"}
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("serverList.drawer.avgTrueskillTooltip")}
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="!h-4 self-center" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={badgeClassName}>
            <Medal className="size-3 text-amber-400" />
            QElo {"\u00b7"}
            {highestQeloPlayer ? (
              <PlayerName
                className="max-w-28"
                fallbackClassName="inline-block max-w-28 truncate align-bottom text-foreground"
                personaName={highestQeloPlayer.name}
              />
            ) : (
              <span className="max-w-28 truncate text-foreground">-</span>
            )}
            <div className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground">
              {highestQeloPlayer?.qelo != null
                ? Math.round(highestQeloPlayer.qelo)
                : "-"}
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("serverList.drawer.topQeloTooltip")}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={badgeClassName}>
            <Medal className="size-3 text-amber-400" />
            TSkill {"\u00b7"}
            {highestTrueskillPlayer ? (
              <PlayerName
                className="max-w-28"
                fallbackClassName="inline-block max-w-28 truncate align-bottom text-foreground"
                personaName={highestTrueskillPlayer.name}
              />
            ) : (
              <span className="max-w-28 truncate text-foreground">-</span>
            )}
            <div className="rounded-sm bg-muted px-1.5 py-0.5 text-foreground">
              {highestTrueskillPlayer?.trueskill != null
                ? Math.round(highestTrueskillPlayer.trueskill)
                : "-"}
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          {t("serverList.drawer.topTrueskillTooltip")}
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function QlStatsPlayersPanel({ serverAddress }: { serverAddress: string }) {
  const { t } = useTranslation()
  const { isTracked, trackPlayer, untrackPlayer } = useTrackedPlayers()
  const [sorting, setSorting] = useState<SortingState>([
    { id: "points", desc: true },
  ])
  const playersQuery = useQuery({
    queryKey: ["steam", "server", "players", serverAddress],
    queryFn: () => fetchSteamServerPlayers(serverAddress),
    staleTime: 10_000,
  })
  const ratingsQuery = useQuery({
    queryKey: ["steam", "server", "player-ratings", serverAddress],
    queryFn: () => fetchSteamServerPlayerRatings(serverAddress),
    staleTime: 10_000,
  })

  const players = useMemo(() => playersQuery.data ?? [], [playersQuery.data])
  const playerRatingsByName = useMemo<Record<string, ServerPlayerRating>>(
    () =>
      Object.fromEntries(
        (ratingsQuery.data ?? []).map((player) => [
          normalizePlayerName(player.name),
          player,
        ])
      ),
    [ratingsQuery.data]
  )
  const mergedPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        rating: playerRatingsByName[normalizePlayerName(player.name)] ?? null,
      })),
    [playerRatingsByName, players]
  )
  const topRatedPlayerNames = useMemo(() => {
    let highestQelo = Number.NEGATIVE_INFINITY
    let highestTrueskill = Number.NEGATIVE_INFINITY

    for (const player of mergedPlayers) {
      const qelo = player.rating?.qelo ?? Number.NEGATIVE_INFINITY
      const trueskill = player.rating?.trueskill ?? Number.NEGATIVE_INFINITY

      if (qelo > highestQelo) {
        highestQelo = qelo
      }
      if (trueskill > highestTrueskill) {
        highestTrueskill = trueskill
      }
    }

    const names = new Set<string>()

    for (const player of mergedPlayers) {
      if (player.rating?.qelo != null && player.rating.qelo === highestQelo) {
        names.add(normalizePlayerName(player.name))
      }

      if (
        player.rating?.trueskill != null &&
        player.rating.trueskill === highestTrueskill
      ) {
        names.add(normalizePlayerName(player.name))
      }
    }

    return names
  }, [mergedPlayers])
  const playerPanelPending =
    playersQuery.isPending ||
    (playersQuery.fetchStatus === "fetching" && !playersQuery.data) ||
    ratingsQuery.isPending
  const playerPanelFrameClass = "min-h-[20rem]"

  const columns = useMemo<ColumnDef<DrawerPlayer>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.drawer.player")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const steamId = row.original.rating?.steam_id
          const isTopRated = topRatedPlayerNames.has(
            normalizePlayerName(row.original.name)
          )

          if (!steamId) {
            return (
              <div className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <span className="truncate">
                  <PlayerName
                    fallbackClassName="truncate"
                    personaName={row.original.name}
                  />
                </span>
                {isTopRated ? (
                  <Medal className="size-3.5 shrink-0 text-amber-400" />
                ) : null}
              </div>
            )
          }

          return (
            <button
              type="button"
              onClick={() => {
                openExternalUrl(getQlStatsPlayerProfileUrl(steamId))
              }}
              className="group flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <span className="truncate">
                <PlayerName
                  fallbackClassName="truncate"
                  personaName={row.original.name}
                />
              </span>
              {isTopRated ? (
                <Medal className="size-3.5 shrink-0 text-amber-400" />
              ) : null}
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </button>
          )
        },
      },
      {
        id: "points",
        accessorFn: (row) => row.score,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.drawer.points")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => row.original.score,
      },
      {
        id: "qelo",
        accessorFn: (row) => row.rating?.qelo ?? Number.NEGATIVE_INFINITY,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            QElo
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          row.original.rating?.qelo != null
            ? Math.round(row.original.rating.qelo)
            : "-",
      },
      {
        id: "trueskill",
        accessorFn: (row) => row.rating?.trueskill ?? Number.NEGATIVE_INFINITY,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            TSkill
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          row.original.rating?.trueskill != null
            ? Math.round(row.original.rating.trueskill)
            : "-",
      },
      {
        id: "time",
        accessorFn: (row) => row.duration_seconds,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] tracking-[0.12em] text-muted-foreground uppercase hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.drawer.time")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          formatDurationHoursMinutes(row.original.duration_seconds),
      },
      {
        id: "watch",
        header: () => (
          <div className="text-right text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
            {t("serverList.drawer.watch")}
          </div>
        ),
        cell: ({ row }) => {
          const steamId = row.original.rating?.steam_id
          if (!steamId) {
            return null
          }

          const tracked = isTracked(steamId)
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="ml-auto size-8"
                  onClick={() => {
                    const playerName = stripQuakeColors(row.original.name)
                    if (tracked) {
                      if (untrackPlayer(steamId)) {
                        toast.success(
                          t("watchlist.toasts.untracked", {
                            player: playerName,
                          })
                        )
                      }
                      return
                    }

                    if (trackPlayer(steamId, row.original.name)) {
                      toast.success(
                        t("watchlist.toasts.tracked", {
                          player: playerName,
                        })
                      )
                    }
                  }}
                >
                  {tracked ? (
                    <UserMinus className="size-4" />
                  ) : (
                    <UserPlus className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {tracked
                  ? t("serverList.drawer.untrackPlayer")
                  : t("serverList.drawer.trackPlayer")}
              </TooltipContent>
            </Tooltip>
          )
        },
      },
    ],
    [isTracked, t, topRatedPlayerNames, trackPlayer, untrackPlayer]
  )

  const table = useReactTable({
    data: mergedPlayers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const sortedRows = table.getRowModel().rows
  const hasKnownTeams = mergedPlayers.some(
    (player) => player.rating?.team != null
  )
  const hasRedBlueTeams = mergedPlayers.some((player) => {
    const team = player.rating?.team
    return team === 1 || team === 2
  })
  const teamSections = useMemo(() => {
    if (!hasKnownTeams) {
      return []
    }

    const groupedRows = new Map<PlayerTeamSectionKey, typeof sortedRows>()
    const sectionOrder: PlayerTeamSectionKey[] = hasRedBlueTeams
      ? ["red", "blue", "free", "spectators", "unassigned"]
      : ["players", "spectators", "unassigned"]

    for (const row of sortedRows) {
      const sectionKey = getPlayerTeamSectionKey(
        row.original.rating?.team,
        hasRedBlueTeams
      )
      const existingRows = groupedRows.get(sectionKey) ?? []
      existingRows.push(row)
      groupedRows.set(sectionKey, existingRows)
    }

    return sectionOrder
      .map((sectionKey) => ({
        ...playerTeamSectionMeta[sectionKey],
        key: sectionKey,
        rows: groupedRows.get(sectionKey) ?? [],
      }))
      .filter((section) => section.rows.length > 0)
  }, [hasKnownTeams, hasRedBlueTeams, sortedRows])
  const shouldRenderTeamSections = teamSections.length > 1

  if (playerPanelPending) {
    return (
      <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.playersHeading")}
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                {Array.from({ length: 6 }).map((_, index) => (
                  <TableHead
                    key={`player-header-skeleton-${index}`}
                    className="h-10 px-4"
                  >
                    <Skeleton className="h-4 w-12" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, index) => (
                <TableRow
                  key={`player-skeleton-${index}`}
                  className="border-b border-border hover:bg-transparent"
                >
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-12" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="h-4 w-14" />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Skeleton className="ml-auto h-8 w-8 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (playersQuery.isError) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("serverList.drawer.lookupFailed")}
      </div>
    )
  }

  if (mergedPlayers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("serverList.drawer.noPlayerData")}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
      <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
        {t("serverList.drawer.playersHeading")}
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-border hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 px-4">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {shouldRenderTeamSections
              ? teamSections.map((section) => (
                  <Fragment key={`player-team-section-${section.key}`}>
                    <TableRow className="border-b border-border bg-muted/10 hover:bg-muted/10">
                      <TableCell
                        colSpan={columns.length}
                        className={`px-3 py-2 text-[11px] font-medium tracking-[0.12em] uppercase ${section.toneClassName}`}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span>{t(section.labelKey)}</span>
                          {section.key === "spectators" ? (
                            <Eye className="size-3.5" />
                          ) : null}
                        </span>
                      </TableCell>
                    </TableRow>
                    {section.rows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="border-b border-border hover:bg-transparent"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className="px-3 py-2 text-sm text-muted-foreground"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              : sortedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-border hover:bg-transparent"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="px-3 py-2 text-sm text-muted-foreground"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function HistoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-3">
      <div className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function formatHistoryTick(timestamp: string) {
  const parsed = parseISO(timestamp)
  return Number.isNaN(parsed.getTime()) ? timestamp : format(parsed, "EEE")
}

function formatHistoryLabel(timestamp: string) {
  const parsed = parseISO(timestamp)
  return Number.isNaN(parsed.getTime())
    ? timestamp
    : format(parsed, "MMM d, HH:mm")
}

function ServerHistoryCard({ serverAddress }: { serverAddress: string }) {
  const { t } = useTranslation()
  const realtimeAvailable = isRealtimeEnabled()
  const historyQuery = useQuery({
    queryKey: ["realtime", "server-history", serverAddress, "7d", "15m"],
    queryFn: () => fetchRealtimeServerHistory(serverAddress, "7d", "15m"),
    enabled: realtimeAvailable,
    staleTime: 60_000,
  })
  const history = historyQuery.data
  const timeline = useMemo(() => history?.timeline ?? [], [history?.timeline])

  const summary = useMemo(() => {
    if (history?.summary) {
      return history.summary
    }

    if (timeline.length === 0) {
      return null
    }

    return {
      lastSeenAt: timeline[timeline.length - 1]?.timestamp ?? null,
      peakPlayers: Math.max(...timeline.map((point) => point.players), 0),
      populatedSampleRatio:
        timeline.filter((point) => point.players > 0).length / timeline.length,
    }
  }, [history, timeline])
  const chartData = useMemo(
    () =>
      timeline.map((point: ServerHistoryPoint) => ({
        ...point,
      })),
    [timeline]
  )

  if (!realtimeAvailable) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.historyTitle")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("serverList.drawer.historyUnavailable")}
        </p>
      </div>
    )
  }

  if (
    historyQuery.isPending ||
    (historyQuery.fetchStatus === "fetching" && historyQuery.data == null)
  ) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.historyTitle")}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
        </div>
        <Skeleton className="mt-4 h-52 rounded-lg" />
      </div>
    )
  }

  if (historyQuery.isError) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.historyTitle")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("serverList.drawer.historyUnavailable")}
        </p>
      </div>
    )
  }

  if (!summary || chartData.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.historyTitle")}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("serverList.drawer.historyEmpty")}
        </p>
      </div>
    )
  }

  const lastSeenLabel = summary.lastSeenAt
    ? formatDistanceToNowStrict(parseISO(summary.lastSeenAt), {
        addSuffix: true,
      })
    : t("serverList.pingUnavailable")
  const populatedPercentage = `${Math.round(
    summary.populatedSampleRatio * 100
  )}%`

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
          {t("serverList.drawer.historyTitle")}
        </div>
        <Badge variant="outline" className="rounded-md">
          {t("serverList.drawer.historyWindow")}
        </Badge>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <HistoryMetric
          label={t("serverList.drawer.historyLastSeen")}
          value={lastSeenLabel}
        />
        <HistoryMetric
          label={t("serverList.drawer.historyPeakPlayers")}
          value={`${summary.peakPlayers}`}
        />
        <HistoryMetric
          label={t("serverList.drawer.historyTimePopulated")}
          value={populatedPercentage}
        />
      </div>

      <ChartContainer
        className="mt-4 h-52 w-full"
        config={{
          players: {
            label: t("serverList.table.players"),
            theme: {
              light: "oklch(0.62 0.14 244)",
              dark: "oklch(0.76 0.11 213)",
            },
          },
        }}
      >
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="history-players" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--color-players)"
                stopOpacity={0.35}
              />
              <stop
                offset="95%"
                stopColor="var(--color-players)"
                stopOpacity={0.05}
              />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="timestamp"
            tickLine={false}
            axisLine={false}
            minTickGap={32}
            tickFormatter={formatHistoryTick}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(label) =>
                  typeof label === "string" ? formatHistoryLabel(label) : ""
                }
                formatter={(value, _name, item) => {
                  const payload = item.payload as ServerHistoryPoint
                  return (
                    <div className="flex min-w-40 flex-col gap-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {t("serverList.table.players")}
                        </span>
                        <span className="font-medium text-foreground">
                          {value}/{payload.maxPlayers}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {t("serverList.table.mode")}
                        </span>
                        <span className="font-medium text-foreground">
                          {getGameModeLabel(payload.gameMode, t) ??
                            t("serverList.modeUnknown")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">
                          {t("serverList.drawer.map")}
                        </span>
                        <span className="font-medium text-foreground">
                          {payload.map ?? "-"}
                        </span>
                      </div>
                    </div>
                  )
                }}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="players"
            stroke="var(--color-players)"
            fill="url(#history-players)"
            strokeWidth={2}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

type ServerDrawerProps = {
  server: SteamServer | null
  open: boolean
  requiresPassword: boolean
  hasSavedPassword: boolean
  canJoin?: boolean
  onOpenChange: (open: boolean) => void
  onJoin: (server: SteamServer) => void
}

export function ServerDrawer({
  server,
  open,
  requiresPassword,
  hasSavedPassword,
  canJoin = true,
  onOpenChange,
  onJoin,
}: ServerDrawerProps) {
  const { t } = useTranslation()
  const selectedMap = server ? getMapEntry(server.map) : null
  const teamScore = server ? getTeamScoreSummary(server) : null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <TooltipProvider>
        <DrawerContent className="h-[85vh] max-h-[85vh] w-full overflow-hidden rounded-t-2xl !border-0 shadow-none">
          {server ? (
            <>
              <div className="relative overflow-hidden border-b border-border">
                {selectedMap ? (
                  <div className="pointer-events-none absolute inset-0">
                    <div
                      className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
                      style={{
                        backgroundImage: `url(${selectedMap.image})`,
                        maskImage:
                          "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                        WebkitMaskImage:
                          "linear-gradient(to bottom, black 0%, black 58%, transparent 100%)",
                        maskSize: "100% 100%",
                        WebkitMaskSize: "100% 100%",
                        maskRepeat: "no-repeat",
                        WebkitMaskRepeat: "no-repeat",
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-background/55 to-background" />
                    <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-background to-transparent" />
                  </div>
                ) : null}
                <div className="relative z-10 h-40">
                  <div className="pointer-events-none absolute inset-x-0 top-11 text-center text-[11px] tracking-[0.14em] text-muted-foreground/80 uppercase">
                    {selectedMap?.name ?? server.map}
                  </div>
                  {teamScore ? (
                    <div className="pointer-events-none absolute inset-x-0 top-16 flex items-center justify-center gap-4">
                      <div className="text-3xl font-semibold tracking-tight text-blue-400 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
                        {teamScore.blue}
                      </div>
                      <div className="text-[10px] tracking-[0.18em] text-muted-foreground/70 uppercase">
                        Score
                      </div>
                      <div className="text-3xl font-semibold tracking-tight text-red-400 drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
                        {teamScore.red}
                      </div>
                    </div>
                  ) : null}
                  <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-left text-lg leading-tight font-semibold text-foreground drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
                          {stripQuakeColors(server.name)}
                        </div>
                        {requiresPassword ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="h-5 shrink-0 gap-1 rounded-md border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-300"
                              >
                                {hasSavedPassword ? (
                                  <Unlock className="size-3" />
                                ) : (
                                  <Lock className="size-3" />
                                )}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {hasSavedPassword
                                ? t("serverList.passwordSaved")
                                : t("serverList.passwordRequired")}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <ServerAverageRatingBadges serverAddress={server.addr} />
                    </div>
                    {canJoin ? (
                      <Button
                        type="button"
                        className="h-9 shrink-0 gap-2 bg-success text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)] hover:bg-success-hover hover:shadow-[0_0_34px_color-mix(in_oklch,var(--color-success-hover)_34%,transparent)]"
                        onClick={() => onJoin(server)}
                      >
                        <Play className="size-4" />
                        {t("serverList.drawer.play")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="space-y-4 px-5 py-4">
                  <QlStatsPlayersPanel serverAddress={server.addr} />
                  <ServerHistoryCard serverAddress={server.addr} />
                </div>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </TooltipProvider>
    </Drawer>
  )
}
