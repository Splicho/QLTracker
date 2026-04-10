import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUpRight,
  Copy,
  Eye,
  Pencil,
  RefreshCw,
} from "lucide-react";
import {
  HeartCrossed,
  HeartFilled,
  HeartOutline,
  Lock,
  Medal,
  Play,
  SlashCircle,
  Unlock,
} from "@/components/icon";
import { PlayerName } from "@/components/pickup/player-name";
import { useFavorites } from "@/hooks/use-favorites";
import { useServerPasswords } from "@/hooks/use-server-passwords";
import type { ServerInteractionContext } from "@/hooks/use-server-interactions";
import {
  getCountryFlagSrc,
  getRegionFromCountryCode,
} from "@/lib/countries";
import { getMapEntry } from "@/lib/maps";
import { openExternalUrl } from "@/lib/open-url";
import { fetchRealtimeServerHistory, isRealtimeEnabled } from "@/lib/realtime";
import {
  fetchSteamServerPlayerRatings,
  fetchSteamServerPlayers,
  type ServerPlayerRating,
  type SteamServer,
} from "@/lib/steam";
import { formatDurationHoursMinutes } from "@/lib/time";
import {
  RATING_FILTER_MAX,
  RATING_FILTER_MIN,
  type ServerFiltersValue,
} from "@/lib/server-filters";
import { ServerFavoriteDialog } from "@/components/server/server-favorite-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";

const regionLabels: Record<string, string> = {
  eu: "EU",
  na: "NA",
  sa: "SA",
  za: "ZA",
  apac: "APAC",
};

const steamRegionMap: Record<number, keyof typeof regionLabels> = {
  0: "na",
  1: "na",
  2: "sa",
  3: "eu",
  5: "za",
  7: "apac",
};

const modeLabelKeys: Record<string, string> = {
  ca: "filters.modes.ca",
  duel: "filters.modes.duel",
  ffa: "filters.modes.ffa",
  tdm: "filters.modes.tdm",
  ctf: "filters.modes.ctf",
  ad: "filters.modes.ad",
  dom: "filters.modes.dom",
  ft: "filters.modes.ft",
  har: "filters.modes.har",
  race: "filters.modes.race",
  rr: "filters.modes.rr",
  td: "filters.modes.tdm",
  "1f": "filters.modes.ctf",
};

const serverListLayoutTransition = {
  layout: {
    type: "spring" as const,
    stiffness: 420,
    damping: 34,
    mass: 0.82,
  },
};

const serverListRowTransition = {
  layout: {
    type: "spring" as const,
    stiffness: 420,
    damping: 34,
    mass: 0.82,
  },
};

function sortServersForPage(
  servers: SteamServer[],
  sorting: SortingState,
  modesByAddr: Record<string, string | null>
) {
  if (sorting.length === 0) {
    return servers;
  }

  const [{ id, desc }] = sorting;
  const direction = desc ? -1 : 1;

  const sorted = [...servers];
  sorted.sort((left, right) => {
    const leftMode = modesByAddr[left.addr] ?? normalizeGameMode(left) ?? "";
    const rightMode = modesByAddr[right.addr] ?? normalizeGameMode(right) ?? "";
    let value = 0;

    switch (id) {
      case "name":
        value = left.name.localeCompare(right.name);
        break;
      case "mode":
        value = leftMode.localeCompare(rightMode);
        break;
      case "map":
        value = left.map.localeCompare(right.map);
        break;
      case "players":
        value = left.players - right.players;
        break;
      default:
        value = 0;
    }

    if (value !== 0) {
      return value * direction;
    }

    return left.name.localeCompare(right.name);
  });

  return sorted;
}

type ServerListProps = {
  servers: SteamServer[];
  filters: ServerFiltersValue;
  isLoading?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  error?: string | null;
  actionMode?: "add" | "edit";
  favoriteListId?: string | null;
  onOpenServer?: (context: ServerInteractionContext) => void;
  onJoinServer?: (context: ServerInteractionContext) => void;
};

function normalizeSteamServerRegion(server: SteamServer) {
  return server.region != null ? (steamRegionMap[server.region] ?? null) : null;
}

function resolveServerRegion(server: SteamServer) {
  return (
    getRegionFromCountryCode(server.country_code) ??
    normalizeSteamServerRegion(server)
  );
}

function normalizeGameMode(server: SteamServer) {
  if (server.game_mode?.trim()) {
    return server.game_mode.trim().toLowerCase();
  }

  const knownModes: Record<string, string> = {
    ca: "ca",
    clanarena: "ca",
    duel: "duel",
    ffa: "ffa",
    freeforall: "ffa",
    tdm: "tdm",
    teamdeathmatch: "tdm",
    ctf: "ctf",
    ad: "ad",
    attackdefend: "ad",
    attackanddefend: "ad",
    dom: "dom",
    domination: "dom",
    ft: "ft",
    freezetag: "ft",
    har: "har",
    harvester: "har",
    race: "race",
    rr: "rr",
    redrover: "rr",
  };

  const keywordParts =
    server.keywords
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean) ?? [];

  for (const part of keywordParts) {
    if (part.startsWith("g_")) {
      const normalized = part.replace(/^g_/, "");
      return knownModes[normalized] ?? normalized;
    }

    const compact = part.replace(/[\s_-]+/g, "");
    if (compact in knownModes) {
      return knownModes[compact];
    }
  }

  return null;
}

function getGameModeLabel(
  gameMode: string | null | undefined,
  t: (key: string) => string
) {
  if (!gameMode) {
    return null;
  }

  const normalizedMode = gameMode.trim().toLowerCase();
  const key = modeLabelKeys[normalizedMode];

  return key ? t(key) : normalizedMode.toUpperCase();
}

function normalizeTags(server: SteamServer) {
  return (server.keywords ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

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
                  <PlayerName fallbackClassName="truncate" personaName={row.original.name} />
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
                openExternalUrl(getQlStatsPlayerProfileUrl(steamId));
              }}
              className="group flex min-w-0 cursor-pointer items-center gap-1.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              <span className="truncate">
                <PlayerName fallbackClassName="truncate" personaName={row.original.name} />
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
    [topRatedPlayerNames]
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

const legacyServerDrawerReferences = {
  ServerAverageRatingBadges,
  QlStatsPlayersPanel,
};
void legacyServerDrawerReferences;

export function ServerList({
  servers,
  filters,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  error = null,
  actionMode = "add",
  favoriteListId = null,
  onOpenServer,
  onJoinServer,
}: ServerListProps) {
  const queryClient = useQueryClient();
  const {
    state: favoritesState,
    addServerToList,
    moveServerToList,
    removeServer,
    removeServerFromList,
  } = useFavorites();
  const { t } = useTranslation();
  const { getPassword } = useServerPasswords();
  const realtimeAvailable = isRealtimeEnabled();
  const [favoriteServer, setFavoriteServer] = useState<SteamServer | null>(
    null
  );
  const [favoriteDialogAction, setFavoriteDialogAction] = useState<
    "save" | "remove" | null
  >(null);
  const [targetFavoriteListId, setTargetFavoriteListId] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "players", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const deferredSearch = useDeferredValue(filters.search);
  const favoriteAddresses = useMemo(
    () => new Set(favoritesState.servers.map((server) => server.addr)),
    [favoritesState.servers]
  );

  const staticFilteredServers = useMemo(() => {
    const search = deferredSearch.trim().toLowerCase();
    const tagQuery = filters.tags.map((tag) => tag.toLowerCase());

    return servers.filter((server) => {
      const gameMode = normalizeGameMode(server);
      const tags = normalizeTags(server);

      if (search && !server.name.toLowerCase().includes(search)) {
        return false;
      }

      if (filters.gameMode !== "all" && gameMode !== filters.gameMode) {
        return false;
      }

      if (filters.maps.length > 0 && !filters.maps.includes(server.map)) {
        return false;
      }

      if (filters.showFull && !filters.showEmpty && server.players === 0) {
        return false;
      }

      if (filters.showEmpty && !filters.showFull && server.players > 0) {
        return false;
      }

      if (filters.showFavorites && !favoriteAddresses.has(server.addr)) {
        return false;
      }

      if (
        tagQuery.length > 0 &&
        !tagQuery.every((tag) =>
          tags.some((serverTag) => serverTag.includes(tag))
        )
      ) {
        return false;
      }

      return true;
    });
  }, [
    deferredSearch,
    filters.gameMode,
    filters.showEmpty,
    filters.showFull,
    filters.showFavorites,
    filters.maps,
    filters.tags,
    favoriteAddresses,
    servers,
  ]);

  const regionFilteredServers = useMemo(() => {
    if (filters.region === "all") {
      return staticFilteredServers;
    }

    return staticFilteredServers.filter((server) => {
      const region = resolveServerRegion(server);
      return region === filters.region;
    });
  }, [filters.region, staticFilteredServers]);
  const visibilityFilteredServers = useMemo(() => {
    if (filters.visibility === "all") {
      return regionFilteredServers;
    }

    return regionFilteredServers.filter((server) => {
      const requiresPassword = server.requires_password;

      if (filters.visibility === "private") {
        return requiresPassword === true;
      }

      return requiresPassword === false;
    });
  }, [filters.visibility, regionFilteredServers]);

  const ratingFilterActive =
    filters.ratingRange[0] !== RATING_FILTER_MIN ||
    filters.ratingRange[1] !== RATING_FILTER_MAX;
  const filteredServers = useMemo(() => {
    if (!ratingFilterActive) {
      return visibilityFilteredServers;
    }

    const [minRating, maxRating] = filters.ratingRange;

    return visibilityFilteredServers.filter((server) => {
      const ratingValue =
        filters.ratingSystem === "trueskill"
          ? server.avg_trueskill
          : server.avg_qelo;

      return (
        ratingValue != null &&
        ratingValue >= minRating &&
        ratingValue <= maxRating
      );
    });
  }, [
    filters.ratingRange,
    filters.ratingSystem,
    ratingFilterActive,
    visibilityFilteredServers,
  ]);

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    );
  }, [filteredServers.length]);

  const resolvedRequiresPasswordByAddr = useMemo(
    () =>
      Object.fromEntries(
        servers.map(
          (server) => [server.addr, server.requires_password ?? null] as const
        )
      ),
    [servers]
  );
  const resolvedModesByAddr = useMemo(
    () =>
      Object.fromEntries(
        servers.map((server) => [server.addr, normalizeGameMode(server)] as const)
      ),
    [servers]
  );
  const sortedServers = useMemo(
    () =>
      sortServersForPage(
        filteredServers,
        sorting,
        resolvedModesByAddr
      ),
    [filteredServers, resolvedModesByAddr, sorting]
  );
  const createServerInteractionContext = (
    server: SteamServer
  ): ServerInteractionContext => ({
    server,
    modeLabel: getGameModeLabel(
      resolvedModesByAddr[server.addr] ?? normalizeGameMode(server),
      t
    ),
    canJoin: true,
    requiresPassword: resolvedRequiresPasswordByAddr[server.addr] === true,
  });
  const prefetchServerDrawerData = (serverAddress: string) => {
    void queryClient.prefetchQuery({
      queryKey: ["steam", "server", "players", serverAddress],
      queryFn: () => fetchSteamServerPlayers(serverAddress),
      staleTime: 10_000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["steam", "server", "player-ratings", serverAddress],
      queryFn: () => fetchSteamServerPlayerRatings(serverAddress),
      staleTime: 10_000,
    });

    if (!realtimeAvailable) {
      return;
    }

    void queryClient.prefetchQuery({
      queryKey: ["realtime", "server-history", serverAddress, "7d", "15m"],
      queryFn: () => fetchRealtimeServerHistory(serverAddress, "7d", "15m"),
      staleTime: 60_000,
    });
  };

  const columns = useMemo<ColumnDef<SteamServer>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.table.server")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const map = getMapEntry(row.original.map);
          const requiresPassword =
            resolvedRequiresPasswordByAddr[row.original.addr] === true;
          const hasSavedPassword = Boolean(getPassword(row.original.addr));

          return (
            <div className="relative h-11 min-w-0 overflow-hidden">
              {map ? (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-[25%] min-w-28 bg-cover bg-left bg-no-repeat opacity-60"
                  style={{
                    backgroundImage: `url(${map.image})`,
                    maskImage:
                      "linear-gradient(to right, black 0%, black 62%, transparent 100%)",
                    WebkitMaskImage:
                      "linear-gradient(to right, black 0%, black 62%, transparent 100%)",
                    maskSize: "100% 100%",
                    WebkitMaskSize: "100% 100%",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                  }}
                />
              ) : null}
              <div className="relative z-10 flex h-full min-w-0 items-center px-3 text-sm font-medium text-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0 truncate">
                    <PlayerName fallbackClassName="truncate" personaName={row.original.name} />
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
              </div>
            </div>
          );
        },
      },
      {
        id: "country",
        accessorFn: (row) =>
          row.country_name ?? resolveServerRegion(row) ?? "",
        header: () => (
          <div className="px-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {t("serverList.table.location")}
          </div>
        ),
        cell: ({ row }) => {
          const flagSrc = getCountryFlagSrc(row.original.country_code);

          if (!row.original.country_name || !flagSrc) {
            const region = resolveServerRegion(row.original);
            return (
              <span className="text-sm text-muted-foreground">
                {region
                  ? regionLabels[region]
                  : t("serverList.locationUnknown")}
              </span>
            );
          }

          return (
            <img
              src={flagSrc}
              alt={
                row.original.country_code?.toUpperCase() ??
                row.original.country_name
              }
              title={row.original.country_name}
              className="h-4 w-4 rounded-full object-cover"
            />
          );
        },
      },
      {
        id: "mode",
        accessorFn: (row) => normalizeGameMode(row) ?? "",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.table.mode")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const mode = resolvedModesByAddr[row.original.addr] ?? normalizeGameMode(row.original);
          return mode
            ? modeLabelKeys[mode]
              ? t(modeLabelKeys[mode])
              : mode.toUpperCase()
            : t("serverList.modeUnknown");
        },
      },
      {
        id: "players",
        accessorFn: (row) => row.players,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.table.players")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          `${row.original.players}/${row.original.max_players}`,
      },
      {
        id: "actions",
        header: () => (
          <div className="text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {t("serverList.table.actions")}
          </div>
        ),
        cell: ({ row }) => {
          const isFavorited = favoriteAddresses.has(row.original.addr);

          return (
            <div className="flex justify-end gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="group relative size-8"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (actionMode === "add" && isFavorited) {
                        removeServer(row.original.addr);
                        toast.success(
                          t("serverList.toasts.removedFromFavorites")
                        );
                        return;
                      }
                      setTargetFavoriteListId(
                        actionMode === "edit"
                          ? (favoriteListId ?? "")
                          : (favoritesState.lists[0]?.id ?? "")
                      );
                      setFavoriteServer(row.original);
                    }}
                  >
                    {actionMode === "edit" ? (
                      <Pencil className="size-4" />
                    ) : isFavorited ? (
                      <>
                        <HeartFilled className="size-4 text-red-500 transition-opacity group-hover:opacity-0" />
                        <HeartCrossed className="absolute inset-0 m-auto size-4 text-red-500 opacity-0 transition-opacity group-hover:opacity-100" />
                      </>
                    ) : (
                      <HeartOutline className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {actionMode === "edit"
                    ? t("serverList.actions.editFavorite")
                    : isFavorited
                      ? t("serverList.actions.removeFromFavorites")
                      : t("serverList.actions.addToFavorites")}
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                size="icon"
                className="size-8 bg-success text-success-foreground hover:bg-success-hover"
                onClick={(event) => {
                  event.stopPropagation();
                  onJoinServer?.(createServerInteractionContext(row.original));
                }}
              >
                <Play className="size-4" />
              </Button>
            </div>
          );
        },
      },
    ],
      [
        resolvedModesByAddr,
        resolvedRequiresPasswordByAddr,
        getPassword,
        actionMode,
      favoriteAddresses,
      favoriteListId,
      favoritesState.lists,
      onJoinServer,
      removeServer,
      realtimeAvailable,
      t,
      createServerInteractionContext,
      queryClient,
    ]
  );

  const table = useReactTable({
    data: sortedServers,
    columns,
    getRowId: (row) => row.addr,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;
  const visiblePageNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 1
  ).filter((page) => {
    if (pageCount <= 7) {
      return true;
    }

    return (
      page === 1 || page === pageCount || Math.abs(page - currentPage) <= 1
    );
  });
  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col overflow-x-clip">
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background px-4">
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isRefreshing || !onRefresh}
            className="w-full gap-2"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            {t("serverList.refresh")}
          </Button>
        </div>
        <div className="relative min-h-[24rem] flex-1">
          <Table containerClassName="overflow-x-clip overflow-y-visible">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-border hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={`sticky top-14 z-20 bg-background h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground ${
                        header.column.id === "actions" ? "text-right" : ""
                      }`}
                    >
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
            {isLoading ? (
              <TableBody>
                {Array.from({ length: pagination.pageSize }).map((_, index) => (
                  <TableRow
                    key={`server-skeleton-${index}`}
                    className="h-11 border-b border-border"
                  >
                    <TableCell className="relative h-11 p-0 align-middle">
                      <div className="flex h-full items-center px-3">
                        <Skeleton className="h-4 w-56" />
                      </div>
                    </TableCell>
                    <TableCell className="h-11 px-3 py-0 align-middle">
                      <Skeleton className="h-4 w-4 rounded-full" />
                    </TableCell>
                    <TableCell className="h-11 px-3 py-0 align-middle">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="h-11 px-3 py-0 align-middle">
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell className="h-11 px-3 py-0 align-middle">
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell className="h-11 px-3 py-0 align-middle">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="size-8 rounded-md" />
                        <Skeleton className="size-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ) : error ? (
              <TableBody>
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 px-3 py-2 text-center text-muted-foreground"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              </TableBody>
            ) : table.getPaginationRowModel().rows.length > 0 ? (
              <motion.tbody
                layout
                className="[&_tr:last-child]:border-0"
                transition={serverListLayoutTransition}
              >
                <AnimatePresence initial={false}>
                  {table.getPaginationRowModel().rows.map((row) => (
                    <motion.tr
                      key={row.id}
                      layout="position"
                      transition={serverListRowTransition}
                      className="h-11 cursor-pointer border-b border-border transition-colors duration-150 hover:bg-muted/35"
                      onFocus={() => {
                        prefetchServerDrawerData(row.original.addr);
                      }}
                      onMouseEnter={() => {
                        prefetchServerDrawerData(row.original.addr);
                      }}
                      onClick={() => {
                        onOpenServer?.(
                          createServerInteractionContext(row.original)
                        );
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            cell.column.id === "name"
                              ? "relative h-11 p-0 align-middle"
                              : "h-11 px-3 py-0 align-middle"
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            ) : (
              <TableBody>
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 px-3 py-2 text-center text-muted-foreground"
                  >
                    {t("serverList.noServersMatch")}
                  </TableCell>
                </TableRow>
              </TableBody>
            )}
          </Table>
          <AnimatePresence>
            {isRefreshing && !isLoading ? (
              <motion.div
                key="server-list-refresh-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute inset-0 z-10 bg-background/25 backdrop-blur-[2px]"
              />
            ) : null}
          </AnimatePresence>
        </div>
        {!isLoading && !error && pageCount > 1 ? (
          <div className="border-t border-border px-4 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {t("serverList.pageStatus", {
                  current: currentPage,
                  total: pageCount,
                })}
              </div>
              <Pagination className="mx-0 w-auto justify-start sm:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => {
                        table.previousPage();
                      }}
                      className={
                        !table.getCanPreviousPage()
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                  {visiblePageNumbers.map((page, index) => {
                    const previousPage = visiblePageNumbers[index - 1];
                    const needsEllipsis =
                      previousPage != null && page - previousPage > 1;

                    return (
                      <Fragment key={`page-fragment-${page}`}>
                        {needsEllipsis ? (
                          <PaginationItem>
                            <PaginationEllipsis />
                          </PaginationItem>
                        ) : null}
                        <PaginationItem>
                          <PaginationLink
                            isActive={page === currentPage}
                            onClick={() => {
                              table.setPageIndex(page - 1);
                            }}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </Fragment>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => {
                        table.nextPage();
                      }}
                      className={
                        !table.getCanNextPage()
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        ) : null}
      </section>

      <ServerFavoriteDialog
        open={favoriteServer !== null}
        server={favoriteServer}
        actionMode={actionMode}
        favoriteListId={favoriteListId}
        lists={favoritesState.lists}
        targetListId={targetFavoriteListId}
        pendingAction={favoriteDialogAction}
        onOpenChange={(open) => {
          if (!open) {
            setFavoriteServer(null);
            setTargetFavoriteListId("");
            setFavoriteDialogAction(null);
          }
        }}
        onTargetListChange={setTargetFavoriteListId}
        onRemove={() => {
          if (!favoriteServer || !favoriteListId) {
            return;
          }

          setFavoriteDialogAction("remove");
          try {
            removeServerFromList(favoriteServer.addr, favoriteListId);
            toast.success(t("serverList.toasts.removedFromFavorites"));
            setFavoriteServer(null);
            setTargetFavoriteListId("");
          } finally {
            setFavoriteDialogAction(null);
          }
        }}
        onSave={() => {
          if (!favoriteServer || !targetFavoriteListId) {
            return;
          }

          setFavoriteDialogAction("save");
          try {
            if (actionMode === "edit" && favoriteListId) {
              moveServerToList(
                favoriteServer.addr,
                favoriteListId,
                targetFavoriteListId
              );
              toast.success(t("serverList.toasts.favoriteUpdated"));
            } else {
              addServerToList(
                {
                  addr: favoriteServer.addr,
                  name: favoriteServer.name,
                  map: favoriteServer.map,
                },
                targetFavoriteListId
              );
              toast.success(t("serverList.toasts.addedToFavorites"));
            }

            setFavoriteServer(null);
            setTargetFavoriteListId("");
          } finally {
            setFavoriteDialogAction(null);
          }
        }}
      />
    </>
  );
}
