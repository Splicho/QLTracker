import { Fragment, useEffect, useMemo, useState } from "react";
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
import { ArrowUpDown, Pencil, Plus } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Ping, Play } from "@/components/icon";
import { useFavorites } from "@/hooks/use-favorites";
import { getCountryFlagSrc, type ServerCountryLocation } from "@/lib/countries";
import { getMapEntry } from "@/lib/maps";
import { QuakeText, stripQuakeColors } from "@/lib/quake";
import {
  fetchServerModes,
  fetchSteamServerPlayerRatings,
  fetchSteamServerCountries,
  fetchSteamServerPings,
  fetchSteamServerPlayers,
  type ServerMode,
  type ServerPlayerRating,
  type ServerPing,
  type SteamServer,
} from "@/lib/steam";
import { formatDurationHoursMinutes } from "@/lib/time";
import type { ServerFiltersValue } from "@/components/server-filters";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  pingsByAddr: Record<string, number | null>,
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
  error?: string | null;
  actionMode?: "add" | "edit";
  favoriteListId?: string | null;
};

function normalizeServerRegion(server: SteamServer) {
  return server.region != null ? steamRegionMap[server.region] ?? null : null;
}

function normalizeGameMode(server: SteamServer) {
  const keywordMode =
    server.keywords
      ?.split(",")
      .map((part) => part.trim().toLowerCase())
      .find((part) => part.startsWith("g_"))
      ?.replace(/^g_/, "") ?? null;

  return keywordMode ?? null;
}

function normalizeTags(server: SteamServer) {
  return (server.keywords ?? "")
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function normalizePlayerName(name: string) {
  return name.replace(/\^[0-9]/g, "").trim().toLowerCase();
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
        ]),
      ),
    [ratingsQuery.data],
  );
  const mergedPlayers = useMemo(
    () =>
      players.map((player) => ({
        ...player,
        rating: playerRatingsByName[normalizePlayerName(player.name)] ?? null,
      })),
    [playerRatingsByName, players],
  );
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
        cell: ({ row }) => (
          <div className="truncate text-sm font-medium text-foreground">
            <QuakeText text={row.original.name} />
          </div>
        ),
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
    [],
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
                          header.getContext(),
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
  error = null,
  actionMode = "add",
  favoriteListId = null,
}: ServerListProps) {
  const {
    state: favoritesState,
    addServerToList,
    moveServerToList,
    removeServerFromList,
  } = useFavorites();
  const [selectedServer, setSelectedServer] = useState<SteamServer | null>(null);
  const [favoriteServer, setFavoriteServer] = useState<SteamServer | null>(null);
  const [targetFavoriteListId, setTargetFavoriteListId] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "players", desc: true },
  ]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const filteredServers = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const tagQuery = filters.tags.map((tag) => tag.toLowerCase());

    return servers.filter((server) => {
      const region = normalizeServerRegion(server);
      const gameMode = normalizeGameMode(server);
      const tags = normalizeTags(server);

      if (search && !server.name.toLowerCase().includes(search)) {
        return false;
      }

      if (filters.region !== "all" && region !== filters.region) {
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
          tags.some((serverTag) => serverTag.includes(tag)),
        )
      ) {
        return false;
      }

      return true;
    });
  }, [filters, servers]);

  useEffect(() => {
    setPagination((current) =>
      current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
    );
  }, [filteredServers.length]);

  const sortedServersForPage = useMemo(
    () => sortServersForPage(filteredServers, sorting, {}, {}),
    [filteredServers, sorting],
  );
  const pageSliceStart = pagination.pageIndex * pagination.pageSize;
  const pageSliceEnd = pageSliceStart + pagination.pageSize;
  const visiblePageAddresses = useMemo(
    () =>
      sortedServersForPage
        .slice(pageSliceStart, pageSliceEnd)
        .map((server) => server.addr),
    [pageSliceEnd, pageSliceStart, sortedServersForPage],
  );
  const countryQuery = useQuery({
    queryKey: ["steam", "server-countries", visiblePageAddresses],
    queryFn: () => fetchSteamServerCountries(visiblePageAddresses),
    enabled: visiblePageAddresses.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const resolvedCountriesByAddr = useMemo<Record<string, ServerCountryLocation>>(
    () =>
      Object.fromEntries(
        (countryQuery.data ?? []).map((location) => [location.addr, location]),
      ),
    [countryQuery.data],
  );
  const pingQuery = useQuery({
    queryKey: ["steam", "server-pings", visiblePageAddresses],
    queryFn: () => fetchSteamServerPings(visiblePageAddresses),
    enabled: visiblePageAddresses.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const resolvedPingsByAddr = useMemo<Record<string, number | null>>(
    () =>
      Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.ping_ms,
        ]),
      ),
    [pingQuery.data],
  );
  const modeQuery = useQuery({
    queryKey: ["qlstats", "server-modes", visiblePageAddresses],
    queryFn: () => fetchServerModes(visiblePageAddresses),
    enabled: visiblePageAddresses.length > 0,
    staleTime: 1000 * 60 * 5,
  });
  const resolvedModesByAddr = useMemo<Record<string, string | null>>(
    () =>
      Object.fromEntries(
        ((modeQuery.data ?? []) as ServerMode[]).map((entry) => [
          entry.addr,
          entry.game_mode,
        ]),
      ),
    [modeQuery.data],
  );
  const sortedServers = useMemo(
    () => sortServersForPage(filteredServers, sorting, resolvedModesByAddr, resolvedPingsByAddr),
    [filteredServers, resolvedModesByAddr, resolvedPingsByAddr, sorting],
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

          return (
            <div className="relative h-11 min-w-0 overflow-hidden">
              {map ? (
                <div
                  className="pointer-events-none absolute inset-y-0 left-0 w-[25%] min-w-28 bg-cover bg-left bg-no-repeat opacity-60"
                  style={{
                    backgroundImage: `url(${map.image})`,
                    maskImage: "linear-gradient(to right, black 0%, black 62%, transparent 100%)",
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
                <div className="truncate">
                  <QuakeText text={row.original.name} />
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
          normalizeServerRegion(row) ??
          "",
        header: () => (
          <div className="px-0.5 text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Country
          </div>
        ),
        cell: ({ row }) => {
          if (countryLookupPending && !(row.original.addr in resolvedCountriesByAddr)) {
            return <Skeleton className="h-4 w-4 rounded-full" />;
          }

          const location = resolvedCountriesByAddr[row.original.addr];
          const flagSrc = getCountryFlagSrc(location?.country_code);

          if (!location?.country_name || !flagSrc) {
            const region = normalizeServerRegion(row.original);
            return (
              <span className="text-sm text-muted-foreground">
                {region ? regionLabels[region] : "Unknown"}
              </span>
            );
          }

          return (
            <img
              src={flagSrc}
              alt={location.country_code?.toUpperCase() ?? location.country_name}
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
          if (modeLookupPending && !(row.original.addr in resolvedModesByAddr)) {
            return <Skeleton className="h-4 w-20 rounded-md" />;
          }

          const mode = resolvedModesByAddr[row.original.addr] ?? normalizeGameMode(row.original);
          return mode ? modeLabels[mode] ?? mode.toUpperCase() : "Unknown";
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
        cell: ({ row }) => `${row.original.players}/${row.original.max_players}`,
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
        cell: ({ row }) =>
          pingLookupPending && !(row.original.addr in resolvedPingsByAddr) ? (
            <Skeleton className="h-4 w-14 rounded-md" />
          ) : (resolvedPingsByAddr[row.original.addr] ?? row.original.ping_ms) != null ? (
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Ping className="size-3.5 text-lime-400" />
              <span>{resolvedPingsByAddr[row.original.addr] ?? row.original.ping_ms}</span>
            </div>
          ) : (
            "N/A"
          ),
      },
      {
        id: "actions",
        header: () => (
          <div className="text-right text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Actions
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={(event) => {
                    event.stopPropagation();
                    setTargetFavoriteListId(
                      actionMode === "edit"
                        ? favoriteListId ?? ""
                        : favoritesState.lists[0]?.id ?? "",
                    );
                    setFavoriteServer(row.original);
                  }}
                >
                  {actionMode === "edit" ? (
                    <Pencil className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {actionMode === "edit" ? "Edit favorite" : "Add to favorites"}
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              size="icon"
              className="size-8 bg-success text-success-foreground hover:bg-success-hover"
              onClick={(event) => {
                event.stopPropagation();
                handleJoinServer(row.original.addr);
              }}
            >
              <Play className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [
      countryLookupPending,
      modeLookupPending,
      pingLookupPending,
      resolvedCountriesByAddr,
      resolvedModesByAddr,
      resolvedPingsByAddr,
      actionMode,
      favoriteListId,
      favoritesState.lists,
    ],
  );

  const table = useReactTable({
    data: sortedServers,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const selectedMap = selectedServer ? getMapEntry(selectedServer.map) : null;
  const handleJoinServer = (serverAddress: string) => {
    void openUrl(`steam://connect/${serverAddress}`);
  };
  const pageCount = table.getPageCount();
  const currentPage = table.getState().pagination.pageIndex + 1;
  const visiblePageNumbers = Array.from(
    { length: pageCount },
    (_, index) => index + 1,
  ).filter((page) => {
    if (pageCount <= 7) {
      return true;
    }

    return (
      page === 1 ||
      page === pageCount ||
      Math.abs(page - currentPage) <= 1
    );
  });
  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="relative min-h-[24rem] flex-1">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-border hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={`h-9 px-3 text-xs uppercase tracking-[0.12em] text-muted-foreground ${
                        header.column.id === "actions" ? "text-right" : ""
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
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
                          cell.getContext(),
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
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
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
                            href="#"
                            isActive={page === currentPage}
                            onClick={(event) => {
                              event.preventDefault();
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
                      href="#"
                      onClick={(event) => {
                        event.preventDefault();
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
                      <div className="truncate text-left text-lg font-semibold leading-tight text-foreground drop-shadow-[0_1px_10px_rgba(0,0,0,0.55)]">
                        {stripQuakeColors(selectedServer.name)}
                      </div>
                      <div className="mt-1 truncate text-left text-sm leading-tight text-muted-foreground/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                        {selectedServer.addr}
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="h-9 shrink-0 gap-2 bg-success text-success-foreground shadow-[0_0_28px_color-mix(in_oklch,var(--color-success)_28%,transparent)] hover:bg-success-hover hover:shadow-[0_0_34px_color-mix(in_oklch,var(--color-success-hover)_34%,transparent)]"
                      onClick={() => handleJoinServer(selectedServer.addr)}
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
            <Select value={targetFavoriteListId} onValueChange={setTargetFavoriteListId}>
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
              No favorite lists available. Create a list on the Favorites page first.
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
                (actionMode === "edit" && targetFavoriteListId === favoriteListId)
              }
              onClick={() => {
                if (!favoriteServer || !targetFavoriteListId) {
                  return;
                }

                if (actionMode === "edit" && favoriteListId) {
                  moveServerToList(
                    favoriteServer.addr,
                    favoriteListId,
                    targetFavoriteListId,
                  );
                  toast.success("Favorite updated.");
                } else {
                  addServerToList(
                    {
                      addr: favoriteServer.addr,
                      name: favoriteServer.name,
                      map: favoriteServer.map,
                    },
                    targetFavoriteListId,
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
    </>
  );
}
