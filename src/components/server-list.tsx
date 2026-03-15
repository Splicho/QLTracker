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
import {
  getCountryFlagSrc,
  getRegionFromCountryCode,
  type ServerCountryLocation,
} from "@/lib/countries";
import { getMapEntry } from "@/lib/maps";
import { QuakeText, stripQuakeColors } from "@/lib/quake";
import {
  fetchServerModes,
  fetchSteamServerRatingSummaries,
  fetchSteamServerPlayerRatings,
  fetchSteamServerCountries,
  fetchSteamServerPings,
  fetchSteamServerPlayers,
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
} from "@/components/server-filters";
import { ServerNotificationDialog } from "@/components/server-notification-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const modeLabels: Record<string, string> = {
  ca: "Clan Arena",
  duel: "Duel",
  ffa: "Free For All",
  tdm: "Team DM",
  ctf: "CTF",
  ad: "Attack & Defend",
  dom: "Domination",
  ft: "Freeze Tag",
  har: "Harvester",
  race: "Race",
  rr: "Red Rover",
  td: "Tournament DM",
  "1f": "1 Flag CTF",
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

function ServerAverageRatingBadges({
  serverAddress,
}: {
  serverAddress: string;
}) {
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
        <TooltipContent side="top">Average QElo on this server</TooltipContent>
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
          Average TSkill on this server
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
          Highest QElo player on this server
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
          Highest TSkill player on this server
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function QlStatsPlayersPanel({ serverAddress }: { serverAddress: string }) {
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
      const trueskill =
        player.rating?.trueskill ?? Number.NEGATIVE_INFINITY;

      if (qelo > highestQelo) {
        highestQelo = qelo;
      }
      if (trueskill > highestTrueskill) {
        highestTrueskill = trueskill;
      }
    }

    const names = new Set<string>();

    for (const player of mergedPlayers) {
      if (
        player.rating?.qelo != null &&
        player.rating.qelo === highestQelo
      ) {
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

  const columns = useMemo<ColumnDef<(typeof mergedPlayers)[number]>[]>(
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
            Player
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
            Points
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
            Time
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

  if (playerPanelPending) {
    return (
      <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
        <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
          Players
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
        Steam player lookup failed.
      </div>
    );
  }

  if (mergedPlayers.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No player data for this server.
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${playerPanelFrameClass}`}>
      <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
        Players
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
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-b border-border hover:bg-transparent"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className="px-3 py-2 text-sm text-muted-foreground"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

export function ServerList({
  servers,
  filters,
  isLoading = false,
  isRefreshing = false,
  onRefresh,
  error = null,
  actionMode = "add",
  favoriteListId = null,
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
  const { getPassword, savePassword } = useServerPasswords();
  const [selectedServer, setSelectedServer] = useState<SteamServer | null>(
    null
  );
  const [favoriteServer, setFavoriteServer] = useState<SteamServer | null>(
    null
  );
  const [notificationServer, setNotificationServer] = useState<SteamServer | null>(
    null
  );
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

      if (filters.hideEmpty && server.players === 0) {
        return false;
      }

      if (filters.hideFull && server.players >= server.max_players) {
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
    filters.hideEmpty,
    filters.hideFull,
    filters.maps,
    filters.tags,
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
  const searchEnrichmentEnabled = filters.search.trim().length === 0;
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
  const countryQuery = useQuery({
    queryKey: ["steam", "server-countries", visiblePageAddresses],
    queryFn: () => fetchSteamServerCountries(visiblePageAddresses),
    enabled: searchEnrichmentEnabled && visiblePageAddresses.length > 0,
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
    queryKey: ["steam", "server-pings", visiblePageAddresses],
    queryFn: () => fetchSteamServerPings(visiblePageAddresses),
    enabled: searchEnrichmentEnabled && visiblePageAddresses.length > 0,
    staleTime: 0,
    refetchOnMount: "always",
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
    queryKey: ["qlstats", "server-modes", visiblePageAddresses],
    queryFn: () => fetchServerModes(visiblePageAddresses),
    enabled: searchEnrichmentEnabled && visiblePageAddresses.length > 0,
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
            Server
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const map = getMapEntry(row.original.map);
          const requiresPassword =
            resolvedRequiresPasswordByAddr[row.original.addr] === true;
          const hasSavedPassword = Boolean(getPassword(row.original.addr));
          const notificationRule = rulesByServerAddr[row.original.addr];
          const hasActiveNotification =
            actionMode === "edit" && notificationRule?.enabled === true;

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
                          ? "Password saved"
                          : "Password required"}
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
                        Discord notification enabled
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
            Location
          </div>
        ),
        cell: ({ row }) => {
          if (
            countryLookupPending &&
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
                {region ? regionLabels[region] : "Unknown"}
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
            Mode
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          if (
            modeLookupPending &&
            !(row.original.addr in resolvedModesByAddr)
          ) {
            return <Skeleton className="h-4 w-20 rounded-md" />;
          }

          const mode =
            resolvedModesByAddr[row.original.addr] ??
            normalizeGameMode(row.original);
          return mode ? (modeLabels[mode] ?? mode.toUpperCase()) : "Unknown";
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
            Players
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
            Ping
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const ping = resolvedPingsByAddr[row.original.addr] ?? row.original.ping_ms;

          if (pingLookupPending && !(row.original.addr in resolvedPingsByAddr)) {
            return <Skeleton className="h-4 w-14 rounded-md" />;
          }

          if (ping == null && !pingLookupPending) {
            return "N/A";
          }

          return (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Ping className={`size-3.5 ${getPingIconClassName(ping ?? 999)}`} />
              <span>{ping ?? "-"}</span>
            </div>
          );
        },
      },
      {
        id: "actions",
        header: () => (
          <div className="text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Actions
          </div>
        ),
        cell: ({ row }) => {
          const isFavorited = favoriteAddresses.has(row.original.addr);
          const notificationRule = rulesByServerAddr[row.original.addr] ?? null;
          const isPrivateServer =
            resolvedRequiresPasswordByAddr[row.original.addr] === true;
          const hasDmWarning =
            notificationUser != null && notificationUser.dmAvailable === false;
          const notificationDisabledReason =
            actionMode !== "edit"
              ? null
              : isPrivateServer
                ? "Notifications are available only for public servers."
                : !notificationUser
                  ? "Connect Discord in Favorites to enable notifications."
                  : null;
          const notificationTooltip =
            actionMode !== "edit"
              ? null
              : notificationDisabledReason ??
                (notificationRule ? "Edit Discord notification" : "Notify on Discord");

          return (
            <div className="flex justify-end gap-2">
              {actionMode === "edit" && notificationsAvailable ? (
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
                  <TooltipContent side="top">{notificationTooltip}</TooltipContent>
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
                        toast.success("Removed from favorites.");
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
                    ? "Edit favorite"
                    : isFavorited
                      ? "Remove from favorites"
                      : "Add to favorites"}
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

  const selectedMap = selectedServer ? getMapEntry(selectedServer.map) : null;
  const selectedRequiresPassword = selectedServer
    ? resolvedRequiresPasswordByAddr[selectedServer.addr] === true
    : false;
  const selectedHasSavedPassword = selectedServer
    ? Boolean(getPassword(selectedServer.addr))
    : false;
  const launchServer = (serverAddress: string, password?: string) => {
    void openUrl(buildSteamConnectUrl(serverAddress, password));
  };
  const handleJoinServer = (server: SteamServer) => {
    const requiresPassword =
      resolvedRequiresPasswordByAddr[server.addr] === true;
    if (!requiresPassword) {
      launchServer(server.addr);
      return;
    }

    const savedPassword = getPassword(server.addr);
    if (savedPassword) {
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
      if (existingRuleId) {
        await updateRule({
          ruleId: existingRuleId,
          patch: input,
        });
        toast.success("Notification updated.");
      } else {
        await createRule(input);
        toast.success("Notification created.");
      }

      setNotificationServer(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save the notification rule."
      );
    }
  };
  const handleNotificationDelete = async (ruleId: string) => {
    try {
      await deleteRule(ruleId);
      toast.success("Notification removed.");
      setNotificationServer(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove the notification rule."
      );
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
            <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
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
                  <TableRow
                    key={row.id}
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
                ))
              ) : (
                <TableRow className="border-b border-border">
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 px-3 py-2 text-center text-muted-foreground"
                  >
                    No servers match the current filters.
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
                Page {currentPage} of {pageCount}
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

      <Drawer
        open={selectedServer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedServer(null);
          }
        }}
      >
        <DrawerContent className="h-[85vh] max-h-[85vh] w-full !border-0 rounded-t-2xl shadow-none overflow-hidden">
          {selectedServer ? (
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
                    {selectedMap?.name ?? selectedServer.map}
                  </div>
                  <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-left text-lg font-semibold leading-tight text-foreground drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
                          {stripQuakeColors(selectedServer.name)}
                        </div>
                        {selectedRequiresPassword ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="h-5 shrink-0 gap-1 rounded-md border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] font-medium text-amber-300"
                              >
                                {selectedHasSavedPassword ? (
                                  <Unlock className="size-3" />
                                ) : (
                                  <Lock className="size-3" />
                                )}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {selectedHasSavedPassword
                                ? "Password saved"
                                : "Password required"}
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                      <ServerAverageRatingBadges
                        serverAddress={selectedServer.addr}
                      />
                    </div>
                    <Button
                      type="button"
                      className="h-9 shrink-0 gap-2 bg-success text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)] hover:bg-success-hover hover:shadow-[0_0_34px_color-mix(in_oklch,var(--color-success-hover)_34%,transparent)]"
                      onClick={() => handleJoinServer(selectedServer)}
                    >
                      <Play className="size-4" />
                      Play
                    </Button>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="px-5 py-4">
                  <QlStatsPlayersPanel serverAddress={selectedServer.addr} />
                </div>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <Dialog
        open={favoriteServer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFavoriteServer(null);
            setTargetFavoriteListId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionMode === "edit" ? "Edit Favorite" : "Add To Favorites"}
            </DialogTitle>
            <DialogDescription>
              {favoriteServer ? (
                <span className="block truncate">
                  <QuakeText text={favoriteServer.name} />
                </span>
              ) : (
                "Assign this server to one of your local favorite lists."
              )}
            </DialogDescription>
          </DialogHeader>

          {favoritesState.lists.length > 0 ? (
            <Select
              value={targetFavoriteListId}
              onValueChange={setTargetFavoriteListId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a list" />
              </SelectTrigger>
              <SelectContent>
                {favoritesState.lists.map((list) => (
                  <SelectItem key={list.id} value={list.id}>
                    {list.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              No favorite lists available. Create a list on the Favorites page
              first.
            </p>
          )}

          <DialogFooter>
            {actionMode === "edit" && favoriteListId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!favoriteServer) {
                    return;
                  }

                  removeServerFromList(favoriteServer.addr, favoriteListId);
                  toast.success("Removed from favorites.");
                  setFavoriteServer(null);
                  setTargetFavoriteListId("");
                }}
              >
                Remove
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={
                !favoriteServer ||
                !targetFavoriteListId ||
                favoritesState.lists.length === 0 ||
                (actionMode === "edit" &&
                  targetFavoriteListId === favoriteListId)
              }
              onClick={() => {
                if (!favoriteServer || !targetFavoriteListId) {
                  return;
                }

                if (actionMode === "edit" && favoriteListId) {
                  moveServerToList(
                    favoriteServer.addr,
                    favoriteListId,
                    targetFavoriteListId
                  );
                  toast.success("Favorite updated.");
                } else {
                  addServerToList(
                    {
                      addr: favoriteServer.addr,
                      name: favoriteServer.name,
                      map: favoriteServer.map,
                    },
                    targetFavoriteListId
                  );
                  toast.success("Added to favorites.");
                }

                setFavoriteServer(null);
                setTargetFavoriteListId("");
              }}
            >
              {actionMode === "edit" ? "Save Changes" : "Add To List"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ServerNotificationDialog
        open={notificationServer !== null}
        server={notificationServer}
        existingRule={notificationRuleForDialog}
        pending={notificationMutationPending}
        onOpenChange={(open) => {
          if (!open) {
            setNotificationServer(null);
          }
        }}
        onSave={handleNotificationSave}
        onDelete={handleNotificationDelete}
      />

      <Dialog
        open={passwordServer !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordServer(null);
            setJoinPassword("");
            setRememberServerPassword(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Password</DialogTitle>
            <DialogDescription>
              {passwordServer ? (
                <>
                  Enter the password for{" "}
                  <span className="font-medium text-foreground">
                    {stripQuakeColors(passwordServer.name)}
                  </span>
                  .
                </>
              ) : (
                "Enter the password for this server."
              )}
            </DialogDescription>
          </DialogHeader>

          <Input
            type="password"
            autoFocus
            value={joinPassword}
            onChange={(event) => setJoinPassword(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key !== "Enter" ||
                !passwordServer ||
                !joinPassword.trim()
              ) {
                return;
              }

              const password = joinPassword.trim();
              if (rememberServerPassword) {
                savePassword(passwordServer.addr, password);
              }
              launchServer(passwordServer.addr, password);
              setPasswordServer(null);
              setJoinPassword("");
              setRememberServerPassword(false);
            }}
            placeholder="Enter server password"
          />

          <div className="flex items-start gap-3 rounded-md border border-border px-3 py-2">
            <Checkbox
              id="remember-server-password"
              checked={rememberServerPassword}
              onCheckedChange={(checked) =>
                setRememberServerPassword(checked === true)
              }
              className="mt-0.5"
            />
            <Label
              htmlFor="remember-server-password"
              className="cursor-pointer text-sm font-normal leading-snug text-muted-foreground"
            >
              Save this password locally for future join requests.
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              disabled={!passwordServer || !joinPassword.trim()}
              onClick={() => {
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
                launchServer(passwordServer.addr, password);
                setPasswordServer(null);
                setJoinPassword("");
                setRememberServerPassword(false);
              }}
            >
              Join
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
