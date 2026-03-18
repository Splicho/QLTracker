import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Pencil, Play, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
import { useTrackedPlayers } from "@/hooks/use-tracked-players";
import type { ServerInteractionContext } from "@/hooks/use-server-interactions";
import {
  fetchRealtimePlayerPresenceLookup,
  isRealtimeEnabled,
  type RealtimePlayerPresence,
} from "@/lib/realtime";
import {
  createFallbackServerFromPresence,
  getGameModeLabel,
} from "@/lib/server-utils";
import { type ServerPing, fetchSteamServerPings, type SteamServer } from "@/lib/steam";
import { TrackedPlayerNoteDialog } from "@/components/pages/tracked-player-note-dialog";

export function WatchlistPage({
  servers,
  onOpenServer,
  onJoinServer,
}: {
  servers: SteamServer[];
  onOpenServer: (context: ServerInteractionContext) => void;
  onJoinServer: (context: ServerInteractionContext) => void;
}) {
  const { t } = useTranslation();
  const { players, setPlayerNote, untrackPlayer } = useTrackedPlayers();
  const realtimeAvailable = isRealtimeEnabled();
  const [editingSteamId, setEditingSteamId] = useState<string | null>(null);
  const trackedSteamIds = useMemo(
    () => players.map((player) => player.steamId),
    [players]
  );
  const editingPlayer = useMemo(
    () =>
      editingSteamId
        ? players.find((player) => player.steamId === editingSteamId) ?? null
        : null,
    [editingSteamId, players]
  );
  const presenceQuery = useQuery({
    queryKey: ["realtime", "presence-lookup", trackedSteamIds],
    queryFn: () => fetchRealtimePlayerPresenceLookup(trackedSteamIds),
    enabled: realtimeAvailable && trackedSteamIds.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const liveServersByAddr = useMemo(
    () => Object.fromEntries(servers.map((server) => [server.addr, server])),
    [servers]
  );
  const onlineServerAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(presenceQuery.data ?? {})
            .filter(
              (presence): presence is RealtimePlayerPresence => presence != null
            )
            .map((presence) => presence.addr)
            .filter((addr) => addr in liveServersByAddr)
        )
      ),
    [liveServersByAddr, presenceQuery.data]
  );
  const pingQuery = useQuery({
    queryKey: ["steam", "server-pings", "watchlist", onlineServerAddresses],
    queryFn: () => fetchSteamServerPings(onlineServerAddresses),
    enabled: onlineServerAddresses.length > 0,
    staleTime: 10_000,
    refetchInterval: 15_000,
    placeholderData: (previousData) => previousData,
  });
  const requiresPasswordByAddr = useMemo<Record<string, boolean | null>>(
    () =>
      Object.fromEntries(
        ((pingQuery.data ?? []) as ServerPing[]).map((entry) => [
          entry.addr,
          entry.requires_password,
        ])
      ),
    [pingQuery.data]
  );

  const rows = useMemo(
    () =>
      players.map((trackedPlayer) => {
        const presence = presenceQuery.data?.[trackedPlayer.steamId] ?? null;
        const liveServer = presence ? liveServersByAddr[presence.addr] ?? null : null;
        const modeLabel = getGameModeLabel(presence?.gameMode, t);
        const interactionContext = presence
          ? {
              server: liveServer ?? createFallbackServerFromPresence(presence),
              modeLabel,
              canJoin: liveServer != null,
              requiresPassword:
                liveServer != null
                  ? requiresPasswordByAddr[liveServer.addr] === true
                  : false,
            }
          : null;

        return {
          trackedPlayer,
          presence,
          interactionContext,
        };
      }),
    [liveServersByAddr, players, presenceQuery.data, requiresPasswordByAddr, t]
  );
  const onlineCount = rows.filter((row) => row.presence != null).length;
  const serviceUnavailable = !realtimeAvailable || presenceQuery.isError;

  const copySteamId = async (steamId: string) => {
    try {
      await navigator.clipboard.writeText(steamId);
      toast.success(t("watchlist.toasts.steamIdCopied"));
    } catch {
      toast.error(t("watchlist.toasts.steamIdCopyError"));
    }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-medium text-foreground">
              {t("watchlist.title")}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("watchlist.summary", {
                count: players.length,
                online: onlineCount,
              })}
            </p>
          </div>
          {serviceUnavailable ? (
            <Badge variant="outline" className="rounded-md">
              {t("watchlist.serviceUnavailableBadge")}
            </Badge>
          ) : null}
        </div>

        {players.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users className="size-6" />
                </EmptyMedia>
                <EmptyTitle>{t("watchlist.emptyTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("watchlist.emptyDescription")}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="text-muted-foreground">
                {t("watchlist.emptyHint")}
              </EmptyContent>
            </Empty>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            {presenceQuery.isPending && realtimeAvailable ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={`watchlist-skeleton-${index}`}
                    className="h-12 rounded-md"
                  />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t("watchlist.columns.player")}</TableHead>
                    <TableHead>{t("watchlist.columns.status")}</TableHead>
                    <TableHead>{t("watchlist.columns.server")}</TableHead>
                    <TableHead>{t("watchlist.columns.map")}</TableHead>
                    <TableHead>{t("watchlist.columns.mode")}</TableHead>
                    <TableHead className="text-right">
                      {t("watchlist.columns.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.trackedPlayer.steamId}>
                      <TableCell className="font-medium text-foreground">
                        {row.trackedPlayer.playerName}
                      </TableCell>
                      <TableCell>
                        {serviceUnavailable ? (
                          <Badge variant="outline" className="rounded-md">
                            {t("watchlist.statusUnavailable")}
                          </Badge>
                        ) : row.presence ? (
                          <Badge className="rounded-md bg-success text-success-foreground">
                            {t("watchlist.statusOnline")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-md">
                            {t("watchlist.statusOffline")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-56 truncate text-muted-foreground">
                        {row.presence ? row.presence.serverName : t("watchlist.offline")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.presence?.map ?? "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.presence
                          ? getGameModeLabel(row.presence.gameMode, t) ??
                            t("serverList.modeUnknown")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  disabled={!row.interactionContext}
                                  onClick={() => {
                                    if (row.interactionContext) {
                                      onOpenServer(row.interactionContext);
                                    }
                                  }}
                                >
                                  <Eye className="size-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("watchlist.actions.viewServer")}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  void copySteamId(row.trackedPlayer.steamId);
                                }}
                              >
                                <Copy className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("watchlist.actions.copySteamId")}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            type="button"
                            size="icon"
                            disabled={row.interactionContext?.canJoin !== true}
                            className="bg-success text-success-foreground hover:bg-success-hover"
                            onClick={() => {
                              if (row.interactionContext?.canJoin) {
                                onJoinServer(row.interactionContext);
                              }
                            }}
                          >
                            <Play className="size-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                onClick={() => {
                                  setEditingSteamId(row.trackedPlayer.steamId);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              {t("watchlist.actions.editNote")}
                            </TooltipContent>
                          </Tooltip>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              if (untrackPlayer(row.trackedPlayer.steamId)) {
                                toast.success(
                                  t("watchlist.toasts.untracked", {
                                    player: row.trackedPlayer.playerName,
                                  })
                                );
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </div>
      <TrackedPlayerNoteDialog
        open={editingPlayer != null}
        trackedPlayer={editingPlayer}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSteamId(null);
          }
        }}
        onSaveNote={setPlayerNote}
      />
    </section>
  );
}
