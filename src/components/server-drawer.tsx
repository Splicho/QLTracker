import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUpRight, Eye } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "react-i18next";
import { Lock, Medal, Play, SlashCircle, Unlock } from "@/components/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getMapEntry } from "@/lib/maps";
import { QuakeText, stripQuakeColors } from "@/lib/quake";
import {
  fetchSteamServerPlayerRatings,
  fetchSteamServerPlayers,
  type ServerPlayerRating,
  type SteamServer,
} from "@/lib/steam";
import { formatDurationHoursMinutes } from "@/lib/time";

function normalizePlayerName(name: string) {
  return name
    .replace(/\^[0-9]/g, "")
    .trim()
    .toLowerCase();
}

function calculateAverage(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => value != null);

  if (numbers.length === 0) {
    return null;
  }

  return Math.round(
    numbers.reduce((total, value) => total + value, 0) / numbers.length
  );
}

function calculateHighestRatedPlayer(
  players: ServerPlayerRating[],
  ratingKey: "qelo" | "trueskill"
) {
  return players.reduce<ServerPlayerRating | null>((highest, player) => {
    const rating = player[ratingKey];

    if (rating == null) {
      return highest;
    }

    if (highest == null) {
      return player;
    }

    return rating > (highest[ratingKey] ?? Number.NEGATIVE_INFINITY)
      ? player
      : highest;
  }, null);
}

function getQlStatsPlayerProfileUrl(steamId: string) {
  return `https://qlstats.net/player/${steamId}`;
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
} as const;

type PlayerTeamSectionKey = keyof typeof playerTeamSectionMeta;

type DrawerPlayer = SteamServer["players_info"][number] & {
  rating: ServerPlayerRating | null;
};

function getPlayerTeamSectionKey(
  team: number | null | undefined,
  hasRedBlueTeams: boolean
): PlayerTeamSectionKey {
  if (team === 1) {
    return "red";
  }

  if (team === 2) {
    return "blue";
  }

  if (team === 3) {
    return "spectators";
  }

  if (team === 0) {
    return hasRedBlueTeams ? "free" : "players";
  }

  return "unassigned";
}

function ServerAverageRatingBadges({
  serverAddress,
}: {
  serverAddress: string;
}) {
  const { t } = useTranslation();
  const ratingsQuery = useQuery({
    queryKey: ["steam", "server", "player-ratings", serverAddress],
    queryFn: () => fetchSteamServerPlayerRatings(serverAddress),
    staleTime: 30_000,
  });
  const ratings = ratingsQuery.data ?? [];

  const averageQelo = useMemo(
    () => calculateAverage(ratings.map((player) => player.qelo)),
    [ratings]
  );
  const averageTrueskill = useMemo(
    () => calculateAverage(ratings.map((player) => player.trueskill)),
    [ratings]
  );
  const highestQeloPlayer = useMemo(
    () => calculateHighestRatedPlayer(ratings, "qelo"),
    [ratings]
  );
  const highestTrueskillPlayer = useMemo(
    () => calculateHighestRatedPlayer(ratings, "trueskill"),
    [ratings]
  );
  const isPending =
    ratingsQuery.isPending ||
    (ratingsQuery.fetchStatus === "fetching" && !ratingsQuery.data);
  const badgeClassName =
    "rounded-md pl-2 pr-1 py-1 text-[11px] font-medium tracking-[0.01em]";

  if (isPending) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
        <Separator orientation="vertical" className="h-7" />
        <Skeleton className="h-7 w-36 rounded-md" />
        <Skeleton className="h-7 w-36 rounded-md" />
      </div>
    );
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
              <QuakeText
                text={highestQeloPlayer.name}
                fallbackClassName="inline-block max-w-28 truncate align-bottom text-foreground"
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
              <QuakeText
                text={highestTrueskillPlayer.name}
                fallbackClassName="inline-block max-w-28 truncate align-bottom text-foreground"
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
  );
}

function QlStatsPlayersPanel({ serverAddress }: { serverAddress: string }) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "points", desc: true },
  ]);
  const playersQuery = useQuery({
    queryKey: ["steam", "server", "players", serverAddress],
    queryFn: () => fetchSteamServerPlayers(serverAddress),
    staleTime: 30_000,
  });
  const ratingsQuery = useQuery({
    queryKey: ["steam", "server", "player-ratings", serverAddress],
    queryFn: () => fetchSteamServerPlayerRatings(serverAddress),
    staleTime: 30_000,
  });

  const players = playersQuery.data ?? [];
  const playerRatingsByName = useMemo<Record<string, ServerPlayerRating>>(
    () =>
      Object.fromEntries(
        (ratingsQuery.data ?? []).map((player) => [
          normalizePlayerName(player.name),
          player,
        ])
      ),
    [ratingsQuery.data]
  );
  const mergedPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        rating: playerRatingsByName[normalizePlayerName(player.name)] ?? null,
      })),
    [playerRatingsByName, players]
  );
  const topRatedPlayerNames = useMemo(() => {
    let highestQelo = Number.NEGATIVE_INFINITY;
    let highestTrueskill = Number.NEGATIVE_INFINITY;

    for (const player of mergedPlayers) {
      const qelo = player.rating?.qelo ?? Number.NEGATIVE_INFINITY;
      const trueskill = player.rating?.trueskill ?? Number.NEGATIVE_INFINITY;

      if (qelo > highestQelo) {
        highestQelo = qelo;
      }
      if (trueskill > highestTrueskill) {
        highestTrueskill = trueskill;
      }
    }

    const names = new Set<string>();

    for (const player of mergedPlayers) {
      if (player.rating?.qelo != null && player.rating.qelo === highestQelo) {
        names.add(normalizePlayerName(player.name));
      }

      if (
        player.rating?.trueskill != null &&
        player.rating.trueskill === highestTrueskill
      ) {
        names.add(normalizePlayerName(player.name));
      }
    }

    return names;
  }, [mergedPlayers]);
  const playerPanelPending =
    playersQuery.isPending ||
    (playersQuery.fetchStatus === "fetching" && !playersQuery.data) ||
    ratingsQuery.isPending;
  const playerPanelFrameClass = "min-h-[20rem]";

  const columns = useMemo<ColumnDef<DrawerPlayer>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.drawer.player")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const steamId = row.original.rating?.steam_id;
          const isTopRated = topRatedPlayerNames.has(
            normalizePlayerName(row.original.name)
          );

          if (!steamId) {
            return (
              <div className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                <span className="truncate">
                  <QuakeText text={row.original.name} />
                </span>
                {isTopRated ? (
                  <Medal className="size-3.5 shrink-0 text-amber-400" />
                ) : null}
              </div>
            );
          }

          return (
            <button
              type="button"
              onClick={() => {
                void openUrl(getQlStatsPlayerProfileUrl(steamId));
              }}
              className="group flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <span className="truncate">
                <QuakeText text={row.original.name} />
              </span>
              {isTopRated ? (
                <Medal className="size-3.5 shrink-0 text-amber-400" />
              ) : null}
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            </button>
          );
        },
      },
      {
        id: "points",
        accessorFn: (row) => row.score,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
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
            className="-ml-2 h-8 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
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
            className="-ml-2 h-8 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
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
            className="-ml-2 h-8 px-2.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.drawer.time")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          formatDurationHoursMinutes(row.original.duration_seconds),
      },
    ],
    [t, topRatedPlayerNames]
  );

  const table = useReactTable({
    data: mergedPlayers,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortedRows = table.getRowModel().rows;
  const hasKnownTeams = mergedPlayers.some(
    (player) => player.rating?.team != null
  );
  const hasRedBlueTeams = mergedPlayers.some((player) => {
    const team = player.rating?.team;
    return team === 1 || team === 2;
  });
  const teamSections = useMemo(() => {
    if (!hasKnownTeams) {
      return [];
    }

    const groupedRows = new Map<PlayerTeamSectionKey, typeof sortedRows>();
    const sectionOrder: PlayerTeamSectionKey[] = hasRedBlueTeams
      ? ["red", "blue", "free", "spectators", "unassigned"]
      : ["players", "spectators", "unassigned"];

    for (const row of sortedRows) {
      const sectionKey = getPlayerTeamSectionKey(
        row.original.rating?.team,
        hasRedBlueTeams
      );
      const existingRows = groupedRows.get(sectionKey) ?? [];
      existingRows.push(row);
      groupedRows.set(sectionKey, existingRows);
    }

    return sectionOrder
      .map((sectionKey) => ({
        ...playerTeamSectionMeta[sectionKey],
        key: sectionKey,
        rows: groupedRows.get(sectionKey) ?? [],
      }))
      .filter((section) => section.rows.length > 0);
  }, [hasKnownTeams, hasRedBlueTeams, sortedRows]);
  const shouldRenderTeamSections = teamSections.length > 1;

  if (playerPanelPending) {
    return (
      <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
        <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          {t("serverList.drawer.playersHeading")}
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="h-10 px-4">
                  <Skeleton className="h-4 w-14" />
                </TableHead>
                <TableHead className="h-10 px-4">
                  <Skeleton className="h-4 w-12" />
                </TableHead>
                <TableHead className="h-10 px-4">
                  <Skeleton className="h-4 w-12" />
                </TableHead>
                <TableHead className="h-10 px-4">
                  <Skeleton className="h-4 w-12" />
                </TableHead>
                <TableHead className="h-10 px-4">
                  <Skeleton className="h-4 w-12" />
                </TableHead>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (playersQuery.isError) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("serverList.drawer.lookupFailed")}
      </div>
    );
  }

  if (mergedPlayers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t("serverList.drawer.noPlayerData")}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
      <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
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
                        className={`px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] ${section.toneClassName}`}
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
  );
}

type ServerDrawerProps = {
  server: SteamServer | null;
  open: boolean;
  requiresPassword: boolean;
  hasSavedPassword: boolean;
  onOpenChange: (open: boolean) => void;
  onJoin: (server: SteamServer) => void;
};

export function ServerDrawer({
  server,
  open,
  requiresPassword,
  hasSavedPassword,
  onOpenChange,
  onJoin,
}: ServerDrawerProps) {
  const { t } = useTranslation();
  const selectedMap = server ? getMapEntry(server.map) : null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
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
                <div className="pointer-events-none absolute inset-x-0 top-11 text-center text-[11px] uppercase tracking-[0.14em] text-muted-foreground/80">
                  {selectedMap?.name ?? server.map}
                </div>
                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-left text-lg font-semibold leading-tight text-foreground drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
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
                  <Button
                    type="button"
                    className="h-9 shrink-0 gap-2 bg-success text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)] hover:bg-success-hover hover:shadow-[0_0_34px_color-mix(in_oklch,var(--color-success-hover)_34%,transparent)]"
                    onClick={() => onJoin(server)}
                  >
                    <Play className="size-4" />
                    {t("serverList.drawer.play")}
                  </Button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="px-5 py-4">
                <QlStatsPlayersPanel serverAddress={server.addr} />
              </div>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
