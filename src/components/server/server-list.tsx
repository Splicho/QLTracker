import {
  Fragment,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
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
  Bell,
  BellOff,
  BellRing,
  Copy,
  Eye,
  Pencil,
  RefreshCw,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  HeartCrossed,
  HeartFilled,
  HeartOutline,
  Lock,
  Medal,
  Ping,
  Play,
  SlashCircle,
  Unlock,
} from "@/components/icon";
import { useFavorites } from "@/hooks/use-favorites";
import { useNotificationService } from "@/hooks/use-notification-service";
import { useServerPasswords } from "@/hooks/use-server-passwords";
import type { DiscordPresenceServerContext } from "@/lib/discord-presence";
import {
  getCountryFlagSrc,
  getRegionFromCountryCode,
  type ServerCountryLocation,
} from "@/lib/countries";
import { getMapEntry } from "@/lib/maps";
import { QuakeText } from "@/lib/quake";
import {
  fetchServerModes,
  fetchSteamServerCountries,
  fetchSteamServerPings,
  fetchSteamServerPlayerRatings,
  fetchSteamServerPlayers,
  fetchSteamServerRatingSummaries,
  type ServerMode,
  type ServerPlayerRating,
  type ServerRatingSummary,
  type ServerPing,
  type SteamServer,
} from "@/lib/steam";
import { formatDurationHoursMinutes } from "@/lib/time";
import type { NotificationRuleInput } from "@/lib/notifications";
import {
  RATING_FILTER_MAX,
  RATING_FILTER_MIN,
  type ServerFiltersValue,
} from "@/components/server/server-filters";
import { ServerDrawer } from "@/components/server/server-drawer";
import { ServerFavoriteDialog } from "@/components/server/server-favorite-dialog";
import { ServerNotificationDialog } from "@/components/server/server-notification-dialog";
import { ServerPasswordDialog } from "@/components/server/server-password-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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

function sortServersForPage(
  servers: SteamServer[],
  sorting: SortingState,
  modesByAddr: Record<string, string | null>,
  pingsByAddr: Record<string, number | null>
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
      case "ping":
        value =
          (pingsByAddr[left.addr] ?? left.ping_ms ?? Number.MAX_SAFE_INTEGER) -
          (pingsByAddr[right.addr] ?? right.ping_ms ?? Number.MAX_SAFE_INTEGER);
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
  onServerLaunched?: (context: DiscordPresenceServerContext) => void;
};

function normalizeSteamServerRegion(server: SteamServer) {
  return server.region != null ? (steamRegionMap[server.region] ?? null) : null;
}

function resolveServerRegion(
  server: SteamServer,
  location?: ServerCountryLocation | null
) {
  return (
    getRegionFromCountryCode(location?.country_code) ??
    normalizeSteamServerRegion(server)
  );
}

function normalizeGameMode(server: SteamServer) {
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

function buildSteamConnectUrl(serverAddress: string, password?: string) {
  const trimmedPassword = password?.trim();
  return trimmedPassword
    ? `steam://connect/${serverAddress}/${encodeURIComponent(trimmedPassword)}`
    : `steam://connect/${serverAddress}`;
}

function getPingIconClassName(ping: number) {
  if (ping <= 25) {
    return "text-lime-400";
  }

  if (ping <= 50) {
    return "text-yellow-400";
  }

  if (ping <= 90) {
    return "text-orange-400";
  }

  return "text-red-400";
}

function haveSameAddresses(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
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
  onServerLaunched,
}: ServerListProps) {
  const {
    state: favoritesState,
    addServerToList,
    moveServerToList,
    removeServer,
    removeServerFromList,
  } = useFavorites();
  const {
    notificationsAvailable,
    notificationUser,
    rulesByServerAddr,
    createRule,
    updateRule,
    deleteRule,
    mutationsPending: notificationMutationPending,
  } = useNotificationService();
  const { t } = useTranslation();
  const { getPassword, savePassword } = useServerPasswords();
  const [selectedServer, setSelectedServer] = useState<SteamServer | null>(
    null
  );
  const [favoriteServer, setFavoriteServer] = useState<SteamServer | null>(
    null
  );
  const [notificationServer, setNotificationServer] =
    useState<SteamServer | null>(null);
  const [favoriteDialogAction, setFavoriteDialogAction] = useState<
    "save" | "remove" | null
  >(null);
  const [notificationDialogAction, setNotificationDialogAction] = useState<
    "save" | "delete" | null
  >(null);
  const [targetFavoriteListId, setTargetFavoriteListId] = useState<string>("");
  const [passwordServer, setPasswordServer] = useState<SteamServer | null>(
    null
  );
  const [joinPassword, setJoinPassword] = useState("");
  const [rememberServerPassword, setRememberServerPassword] = useState(false);
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
  const [cachedCountriesByAddr, setCachedCountriesByAddr] = useState<
    Record<string, ServerCountryLocation>
  >({});
  const [lastKnownPingsByAddr, setLastKnownPingsByAddr] = useState<
    Record<string, number | null>
  >({});
  const [cachedRequiresPasswordByAddr, setCachedRequiresPasswordByAddr] =
    useState<Record<string, boolean | null>>({});
  const [cachedModesByAddr, setCachedModesByAddr] = useState<
    Record<string, string | null>
  >({});
  const [enrichmentAddresses, setEnrichmentAddresses] = useState<string[]>([]);
  const [attemptedCountriesByAddr, setAttemptedCountriesByAddr] = useState<
    Record<string, true>
  >({});
  const [attemptedModesByAddr, setAttemptedModesByAddr] = useState<
    Record<string, true>
  >({});
  const [attemptedPingsByAddr, setAttemptedPingsByAddr] = useState<
    Record<string, true>
  >({});

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

  const regionCandidateAddresses = useMemo(
    () =>
      filters.region !== "all"
        ? staticFilteredServers.map((server) => server.addr)
        : [],
    [filters.region, staticFilteredServers]
  );
  const regionCountryQuery = useQuery({
    queryKey: [
      "steam",
      "server-countries",
      "region-filter",
      regionCandidateAddresses,
    ],
    queryFn: () => fetchSteamServerCountries(regionCandidateAddresses),
    enabled: filters.region !== "all" && regionCandidateAddresses.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const resolvedRegionCountriesByAddr = useMemo<
    Record<string, ServerCountryLocation>
  >(
    () =>
      Object.fromEntries(
        (regionCountryQuery.data ?? []).map((location) => [
          location.addr,
          location,
        ])
      ),
    [regionCountryQuery.data]
  );
  useEffect(() => {
    if (!regionCountryQuery.data?.length) {
      return;
    }

    setCachedCountriesByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        regionCountryQuery.data.map((location) => [location.addr, location])
      ),
    }));
  }, [regionCountryQuery.data]);
  const regionFilteredServers = useMemo(() => {
    if (filters.region === "all") {
      return staticFilteredServers;
    }

    if (regionCountryQuery.isPending && !regionCountryQuery.data) {
      return staticFilteredServers;
    }

    return staticFilteredServers.filter((server) => {
      const region = resolveServerRegion(
        server,
        resolvedRegionCountriesByAddr[server.addr]
      );
      return region === filters.region;
    });
  }, [
    filters.region,
    regionCountryQuery.data,
    regionCountryQuery.isPending,
    resolvedRegionCountriesByAddr,
    staticFilteredServers,
  ]);
  const visibilityCandidateAddresses = useMemo(
    () =>
      filters.visibility !== "all"
        ? regionFilteredServers.map((server) => server.addr)
        : [],
    [filters.visibility, regionFilteredServers]
  );
  const visibilityPingQuery = useQuery({
    queryKey: [
      "steam",
      "server-pings",
      "visibility-filter",
      visibilityCandidateAddresses,
    ],
    queryFn: () => fetchSteamServerPings(visibilityCandidateAddresses),
    enabled:
      filters.visibility !== "all" && visibilityCandidateAddresses.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
    placeholderData: (previousData) => previousData,
  });
  const visibilityRequiresPasswordByAddr = useMemo<
    Record<string, boolean | null>
  >(
    () =>
      Object.fromEntries(
        ((visibilityPingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.requires_password,
        ])
      ),
    [visibilityPingQuery.data]
  );
  useEffect(() => {
    if (!visibilityPingQuery.data?.length) {
      return;
    }

    setCachedRequiresPasswordByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        ((visibilityPingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.requires_password,
        ])
      ),
    }));
    setLastKnownPingsByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        ((visibilityPingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.ping_ms,
        ])
      ),
    }));
  }, [visibilityPingQuery.data]);
  const visibilityFilteredServers = useMemo(() => {
    if (filters.visibility === "all") {
      return regionFilteredServers;
    }

    if (visibilityPingQuery.isPending && !visibilityPingQuery.data) {
      return regionFilteredServers;
    }

    return regionFilteredServers.filter((server) => {
      const requiresPassword = visibilityRequiresPasswordByAddr[server.addr];

      if (filters.visibility === "private") {
        return requiresPassword === true;
      }

      return requiresPassword === false;
    });
  }, [
    filters.visibility,
    regionFilteredServers,
    visibilityPingQuery.data,
    visibilityPingQuery.isPending,
    visibilityRequiresPasswordByAddr,
  ]);

  const ratingFilterActive =
    filters.ratingRange[0] !== RATING_FILTER_MIN ||
    filters.ratingRange[1] !== RATING_FILTER_MAX;
  const ratingCandidateAddresses = useMemo(
    () => visibilityFilteredServers.map((server) => server.addr),
    [visibilityFilteredServers]
  );
  const ratingSummaryQuery = useQuery({
    queryKey: [
      "steam",
      "server-rating-summaries",
      filters.ratingSystem,
      ratingCandidateAddresses,
    ],
    queryFn: () =>
      fetchSteamServerRatingSummaries(
        ratingCandidateAddresses,
        filters.ratingSystem
      ),
    enabled: ratingFilterActive && ratingCandidateAddresses.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const ratingSummariesByAddr = useMemo<Record<string, ServerRatingSummary>>(
    () =>
      Object.fromEntries(
        ((ratingSummaryQuery.data ?? []) as ServerRatingSummary[]).map(
          (summary) => [summary.addr, summary]
        )
      ),
    [ratingSummaryQuery.data]
  );
  const filteredServers = useMemo(() => {
    if (
      !ratingFilterActive ||
      (ratingSummaryQuery.isPending && !ratingSummaryQuery.data)
    ) {
      return visibilityFilteredServers;
    }

    const [minRating, maxRating] = filters.ratingRange;

    return visibilityFilteredServers.filter((server) => {
      const summary = ratingSummariesByAddr[server.addr];
      const ratingValue =
        filters.ratingSystem === "trueskill"
          ? summary?.average_trueskill
          : summary?.average_qelo;

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
    ratingSummariesByAddr,
    ratingSummaryQuery.data,
    ratingSummaryQuery.isPending,
  ]);

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }
    );
  }, [filteredServers.length]);

  const sortedServersForPage = useMemo(
    () => sortServersForPage(filteredServers, sorting, {}, {}),
    [filteredServers, sorting]
  );
  const pageSliceStart = pagination.pageIndex * pagination.pageSize;
  const pageSliceEnd = pageSliceStart + pagination.pageSize;
  const visiblePageAddresses = useMemo(
    () =>
      sortedServersForPage
        .slice(pageSliceStart, pageSliceEnd)
        .map((server) => server.addr),
    [pageSliceEnd, pageSliceStart, sortedServersForPage]
  );
  useEffect(() => {
    const searchDelay = filters.search.trim().length > 0 ? 250 : 0;
    const timeoutId = window.setTimeout(() => {
      setEnrichmentAddresses((current) =>
        haveSameAddresses(current, visiblePageAddresses)
          ? current
          : visiblePageAddresses
      );
    }, searchDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [filters.search, visiblePageAddresses]);
  const enrichmentSyncPending = !haveSameAddresses(
    enrichmentAddresses,
    visiblePageAddresses
  );
  const countryQuery = useQuery({
    queryKey: ["steam", "server-countries", enrichmentAddresses],
    queryFn: () => fetchSteamServerCountries(enrichmentAddresses),
    enabled: enrichmentAddresses.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const latestVisibleCountriesByAddr = useMemo<
    Record<string, ServerCountryLocation>
  >(
    () =>
      Object.fromEntries(
        (countryQuery.data ?? []).map((location) => [location.addr, location])
      ),
    [countryQuery.data]
  );
  useEffect(() => {
    if (!countryQuery.data?.length) {
      return;
    }

    setCachedCountriesByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        countryQuery.data.map((location) => [location.addr, location])
      ),
    }));
  }, [countryQuery.data]);
  const resolvedCountriesByAddr = useMemo<
    Record<string, ServerCountryLocation>
  >(
    () => ({
      ...cachedCountriesByAddr,
      ...resolvedRegionCountriesByAddr,
      ...latestVisibleCountriesByAddr,
    }),
    [
      cachedCountriesByAddr,
      resolvedRegionCountriesByAddr,
      latestVisibleCountriesByAddr,
    ]
  );
  const pingQuery = useQuery({
    queryKey: ["steam", "server-pings", enrichmentAddresses],
    queryFn: () => fetchSteamServerPings(enrichmentAddresses),
    enabled: enrichmentAddresses.length > 0,
    staleTime: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const latestPingsByAddr = useMemo<Record<string, number | null>>(
    () =>
      Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.ping_ms,
        ])
      ),
    [pingQuery.data]
  );
  const latestRequiresPasswordByAddr = useMemo<Record<string, boolean | null>>(
    () =>
      Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.requires_password,
        ])
      ),
    [pingQuery.data]
  );
  useEffect(() => {
    if (!pingQuery.data?.length) {
      return;
    }
    setLastKnownPingsByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.ping_ms,
        ])
      ),
    }));
    setCachedRequiresPasswordByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.requires_password,
        ])
      ),
    }));
  }, [pingQuery.data]);
  const resolvedPingsByAddr = useMemo<Record<string, number | null>>(
    () => ({
      ...lastKnownPingsByAddr,
      ...latestPingsByAddr,
    }),
    [lastKnownPingsByAddr, latestPingsByAddr]
  );
  const resolvedRequiresPasswordByAddr = useMemo<
    Record<string, boolean | null>
  >(
    () => ({
      ...cachedRequiresPasswordByAddr,
      ...latestRequiresPasswordByAddr,
    }),
    [cachedRequiresPasswordByAddr, latestRequiresPasswordByAddr]
  );
  const modeQuery = useQuery({
    queryKey: ["qlstats", "server-modes", enrichmentAddresses],
    queryFn: () => fetchServerModes(enrichmentAddresses),
    enabled: enrichmentAddresses.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const latestModesByAddr = useMemo<Record<string, string | null>>(
    () =>
      Object.fromEntries(
        ((modeQuery.data ?? []) as ServerMode[]).map((entry) => [
          entry.addr,
          entry.game_mode,
        ])
      ),
    [modeQuery.data]
  );
  useEffect(() => {
    if (!modeQuery.data?.length) {
      return;
    }

    setCachedModesByAddr((current) => ({
      ...current,
      ...Object.fromEntries(
        ((modeQuery.data ?? []) as ServerMode[]).map((entry) => [
          entry.addr,
          entry.game_mode,
        ])
      ),
    }));
  }, [modeQuery.data]);
  const resolvedModesByAddr = useMemo<Record<string, string | null>>(
    () => ({
      ...cachedModesByAddr,
      ...latestModesByAddr,
    }),
    [cachedModesByAddr, latestModesByAddr]
  );
  const sortedServers = useMemo(
    () =>
      sortServersForPage(
        filteredServers,
        sorting,
        resolvedModesByAddr,
        resolvedPingsByAddr
      ),
    [filteredServers, resolvedModesByAddr, resolvedPingsByAddr, sorting]
  );
  const countryLookupPending =
    countryQuery.isPending || countryQuery.fetchStatus === "fetching";
  const modeLookupPending =
    modeQuery.isPending || modeQuery.fetchStatus === "fetching";
  const pingLookupPending =
    pingQuery.isPending || pingQuery.fetchStatus === "fetching";

  useEffect(() => {
    if (enrichmentAddresses.length === 0 || countryLookupPending) {
      return;
    }

    setAttemptedCountriesByAddr((current) => ({
      ...current,
      ...Object.fromEntries(enrichmentAddresses.map((addr) => [addr, true])),
    }));
  }, [countryLookupPending, enrichmentAddresses]);

  useEffect(() => {
    if (enrichmentAddresses.length === 0 || modeLookupPending) {
      return;
    }

    setAttemptedModesByAddr((current) => ({
      ...current,
      ...Object.fromEntries(enrichmentAddresses.map((addr) => [addr, true])),
    }));
  }, [modeLookupPending, enrichmentAddresses]);

  useEffect(() => {
    if (enrichmentAddresses.length === 0 || pingLookupPending) {
      return;
    }

    setAttemptedPingsByAddr((current) => ({
      ...current,
      ...Object.fromEntries(enrichmentAddresses.map((addr) => [addr, true])),
    }));
  }, [pingLookupPending, enrichmentAddresses]);

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
          const notificationRule = rulesByServerAddr[row.original.addr];
          const hasActiveNotification = notificationRule?.enabled === true;

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
                    <QuakeText text={row.original.name} />
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
                  {hasActiveNotification ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="h-5 shrink-0 gap-1 rounded-md border-primary/30 bg-primary/10 px-1.5 text-[10px] font-medium text-primary"
                        >
                          <BellRing className="size-3" />
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {t("serverList.notificationEnabled")}
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
          resolvedCountriesByAddr[row.addr]?.country_name ??
          resolveServerRegion(row, resolvedCountriesByAddr[row.addr]) ??
          "",
        header: () => (
          <div className="px-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            {t("serverList.table.location")}
          </div>
        ),
        cell: ({ row }) => {
          if (
            !enrichmentSyncPending &&
            countryLookupPending &&
            !attemptedCountriesByAddr[row.original.addr] &&
            !(row.original.addr in resolvedCountriesByAddr)
          ) {
            return <Skeleton className="h-4 w-4 rounded-full" />;
          }

          const location = resolvedCountriesByAddr[row.original.addr];
          const flagSrc = getCountryFlagSrc(location?.country_code);

          if (!location?.country_name || !flagSrc) {
            const region = resolveServerRegion(row.original, location);
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
                location.country_code?.toUpperCase() ?? location.country_name
              }
              title={location.country_name}
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
          if (
            !enrichmentSyncPending &&
            modeLookupPending &&
            !attemptedModesByAddr[row.original.addr] &&
            !(row.original.addr in resolvedModesByAddr)
          ) {
            return <Skeleton className="h-4 w-20 rounded-md" />;
          }

          const mode =
            resolvedModesByAddr[row.original.addr] ??
            normalizeGameMode(row.original);
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
        id: "ping",
        accessorFn: (row) => row.ping_ms ?? Number.MAX_SAFE_INTEGER,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            className="-ml-2 h-8 px-2.5 text-xs uppercase tracking-[0.12em] text-muted-foreground hover:bg-transparent"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {t("serverList.table.ping")}
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const ping =
            resolvedPingsByAddr[row.original.addr] ?? row.original.ping_ms;

          if (
            !enrichmentSyncPending &&
            pingLookupPending &&
            !attemptedPingsByAddr[row.original.addr] &&
            !(row.original.addr in resolvedPingsByAddr)
          ) {
            return <Skeleton className="h-4 w-14 rounded-md" />;
          }

          if (ping == null && !pingLookupPending) {
            return t("serverList.pingUnavailable");
          }

          return (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Ping
                className={`size-3.5 ${getPingIconClassName(ping ?? 999)}`}
              />
              <span>{ping ?? "-"}</span>
            </div>
          );
        },
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
          const notificationRule = rulesByServerAddr[row.original.addr] ?? null;
          const isPrivateServer =
            resolvedRequiresPasswordByAddr[row.original.addr] === true;
          const shouldShowNotificationAction =
            notificationsAvailable && notificationUser != null;
          const hasDmWarning =
            notificationUser != null && notificationUser.dmAvailable === false;
          const notificationDisabledReason = isPrivateServer
            ? t("serverList.actions.notificationsPublicOnly")
            : null;
          const notificationTooltip =
            notificationDisabledReason ??
            (notificationRule
              ? t("serverList.actions.editNotification")
              : t("serverList.actions.notifyDiscord"));

          return (
            <div className="flex justify-end gap-2">
              {shouldShowNotificationAction ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8"
                      disabled={notificationDisabledReason !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (notificationDisabledReason) {
                          return;
                        }

                        setNotificationServer(row.original);
                      }}
                    >
                      {notificationRule?.enabled ? (
                        <BellRing className="size-4 text-primary" />
                      ) : hasDmWarning ? (
                        <BellOff className="size-4 text-muted-foreground" />
                      ) : notificationRule ? (
                        <BellOff className="size-4 text-muted-foreground" />
                      ) : (
                        <Bell className="size-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {notificationTooltip}
                  </TooltipContent>
                </Tooltip>
              ) : null}
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
                  handleJoinServer(row.original);
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
      countryLookupPending,
      modeLookupPending,
      pingLookupPending,
      enrichmentSyncPending,
      attemptedCountriesByAddr,
      attemptedModesByAddr,
      attemptedPingsByAddr,
      resolvedCountriesByAddr,
      resolvedModesByAddr,
      resolvedPingsByAddr,
      resolvedRequiresPasswordByAddr,
      getPassword,
      actionMode,
      favoriteAddresses,
      favoriteListId,
      favoritesState.lists,
      notificationsAvailable,
      notificationUser,
      removeServer,
      rulesByServerAddr,
      t,
    ]
  );

  const table = useReactTable({
    data: sortedServers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedRequiresPassword = selectedServer
    ? resolvedRequiresPasswordByAddr[selectedServer.addr] === true
    : false;
  const selectedHasSavedPassword = selectedServer
    ? Boolean(getPassword(selectedServer.addr))
    : false;
  const launchPresenceServer = (server: SteamServer) => {
    onServerLaunched?.({
      server,
      modeLabel: getGameModeLabel(
        resolvedModesByAddr[server.addr] ?? normalizeGameMode(server),
        t
      ),
    });
  };
  const launchServer = (serverAddress: string, password?: string) => {
    void openUrl(buildSteamConnectUrl(serverAddress, password));
  };
  const handleJoinServer = (server: SteamServer) => {
    const requiresPassword =
      resolvedRequiresPasswordByAddr[server.addr] === true;
    if (!requiresPassword) {
      launchPresenceServer(server);
      launchServer(server.addr);
      return;
    }

    const savedPassword = getPassword(server.addr);
    if (savedPassword) {
      launchPresenceServer(server);
      launchServer(server.addr, savedPassword);
      return;
    }

    setPasswordServer(server);
    setJoinPassword("");
    setRememberServerPassword(false);
  };
  const notificationRuleForDialog = notificationServer
    ? (rulesByServerAddr[notificationServer.addr] ?? null)
    : null;
  const handleNotificationSave = async (
    input: NotificationRuleInput,
    existingRuleId: string | null
  ) => {
    try {
      setNotificationDialogAction("save");
      if (existingRuleId) {
        await updateRule({
          ruleId: existingRuleId,
          patch: input,
        });
        toast.success(t("serverList.toasts.notificationUpdated"));
      } else {
        await createRule(input);
        toast.success(t("serverList.toasts.notificationCreated"));
      }

      setNotificationServer(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("serverList.toasts.notificationSaveError")
      );
    } finally {
      setNotificationDialogAction(null);
    }
  };
  const handleNotificationDelete = async (ruleId: string) => {
    try {
      setNotificationDialogAction("delete");
      await deleteRule(ruleId);
      toast.success(t("serverList.toasts.notificationRemoved"));
      setNotificationServer(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("serverList.toasts.notificationRemoveError")
      );
    } finally {
      setNotificationDialogAction(null);
    }
  };
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
  const copyServerAddress = async (serverAddress: string) => {
    try {
      await navigator.clipboard.writeText(serverAddress);
      toast.success(t("serverList.toasts.serverAddressCopied"));
    } catch {
      toast.error(t("serverList.toasts.serverAddressCopyError"));
    }
  };
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
            <TableBody>
              {isLoading ? (
                Array.from({ length: pagination.pageSize }).map((_, index) => (
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
                ))
              ) : error ? (
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 px-3 py-2 text-center text-muted-foreground"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : table.getPaginationRowModel().rows.length > 0 ? (
                table.getPaginationRowModel().rows.map((row) => (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className="h-11 cursor-pointer border-b border-border"
                        onClick={() => setSelectedServer(row.original)}
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
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuItem
                        onClick={() => {
                          void copyServerAddress(row.original.addr);
                        }}
                      >
                        <Copy className="size-4" />
                        {t("serverList.actions.copyAddress")}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : (
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 px-3 py-2 text-center text-muted-foreground"
                  >
                    {t("serverList.noServersMatch")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
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

      <ServerDrawer
        open={selectedServer !== null}
        server={selectedServer}
        requiresPassword={selectedRequiresPassword}
        hasSavedPassword={selectedHasSavedPassword}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedServer(null);
          }
        }}
        onJoin={handleJoinServer}
      />

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

      <ServerNotificationDialog
        open={notificationServer !== null}
        server={notificationServer}
        existingRule={notificationRuleForDialog}
        pending={notificationMutationPending}
        pendingAction={notificationDialogAction}
        onOpenChange={(open) => {
          if (!open) {
            setNotificationServer(null);
            setNotificationDialogAction(null);
          }
        }}
        onSave={handleNotificationSave}
        onDelete={handleNotificationDelete}
      />

      <ServerPasswordDialog
        open={passwordServer !== null}
        server={passwordServer}
        password={joinPassword}
        rememberPassword={rememberServerPassword}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordServer(null);
            setJoinPassword("");
            setRememberServerPassword(false);
          }
        }}
        onPasswordChange={setJoinPassword}
        onRememberPasswordChange={setRememberServerPassword}
        onSubmit={() => {
          if (!passwordServer) {
            return;
          }

          const password = joinPassword.trim();
          if (!password) {
            return;
          }

          if (rememberServerPassword) {
            savePassword(passwordServer.addr, password);
          }
          launchPresenceServer(passwordServer);
          launchServer(passwordServer.addr, password);
          setPasswordServer(null);
          setJoinPassword("");
          setRememberServerPassword(false);
        }}
      />
    </>
  );
}
