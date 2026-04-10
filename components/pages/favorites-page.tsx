import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createDefaultServerFilters,
  type ServerFiltersValue,
} from "@/lib/server-filters";
import { GameController } from "@/components/icon";
import { useFavorites } from "@/hooks/use-favorites";
import { ServerList } from "@/components/server/server-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ServerInteractionContext } from "@/hooks/use-server-interactions";
import type { SteamServer } from "@/lib/steam";
import { useTranslation } from "react-i18next";

const emptyFilters: ServerFiltersValue = createDefaultServerFilters();

export function FavoritesPage({
  servers,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
  onOpenServer,
  onJoinServer,
}: {
  servers: SteamServer[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  onRefresh: () => void;
  onOpenServer: (context: ServerInteractionContext) => void;
  onJoinServer: (context: ServerInteractionContext) => void;
}) {
  const { t } = useTranslation();
  const { state, createList, deleteList } = useFavorites();
  const [preferredListId, setPreferredListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [createListOpen, setCreateListOpen] = useState(false);
  const [deleteListOpen, setDeleteListOpen] = useState(false);
  const selectedListId = state.lists.some((list) => list.id === preferredListId)
    ? preferredListId
    : state.lists[0]?.id ?? null;

  const selectedList =
    state.lists.find((list) => list.id === selectedListId) ?? null;

  const favoriteAddresses = useMemo(
    () =>
      state.servers
        .filter((server) =>
          selectedList ? server.listIds.includes(selectedList.id) : false
        )
        .map((server) => server.addr),
    [selectedList, state.servers]
  );
  const serversForSelectedList = useMemo(
    () => servers.filter((server) => favoriteAddresses.includes(server.addr)),
    [favoriteAddresses, servers]
  );
  const playerCountsByList = useMemo(() => {
    const serverMap = new Map(servers.map((server) => [server.addr, server]));

    return Object.fromEntries(
      state.lists.map((list) => {
        const totalPlayers = state.servers
          .filter((server) => server.listIds.includes(list.id))
          .reduce((sum, favoriteServer) => {
            return sum + (serverMap.get(favoriteServer.addr)?.players ?? 0);
          }, 0);

        return [list.id, totalPlayers];
      })
    ) as Record<string, number>;
  }, [servers, state.lists, state.servers]);

  return (
    <section className="flex min-h-0 flex-1 flex-col px-4 py-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="text-sm font-medium text-foreground">
            {t("favorites.lists")}
          </div>
          <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">{t("favorites.createList")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("favorites.createDialogTitle")}</DialogTitle>
                <DialogDescription>
                  {t("favorites.createDialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <Input
                value={listName}
                onChange={(event) => setListName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (!listName.trim()) {
                      return;
                    }

                    createList(listName);
                    setListName("");
                    setCreateListOpen(false);
                  }
                }}
                placeholder={t("favorites.listNamePlaceholder")}
                autoFocus
              />
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    if (!listName.trim()) {
                      return;
                    }

                    createList(listName);
                    setListName("");
                    setCreateListOpen(false);
                  }}
                >
                  {t("favorites.createList")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {state.lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setPreferredListId(list.id)}
                className={`flex min-w-fit cursor-pointer items-center justify-between gap-2 rounded-md pl-2.5 pr-2 py-1.5 text-left text-sm whitespace-nowrap ${
                  selectedList?.id === list.id
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-accent/50"
                }`}
              >
                <span className="truncate">{list.name}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="flex h-6 min-w-6 items-center justify-center gap-1 rounded-md px-1.5 text-xs leading-none"
                    >
                      <GameController className="size-3" />
                      <span>{playerCountsByList[list.id] ?? 0}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-[200]">
                    {t("favorites.playersTooltip")}
                  </TooltipContent>
                </Tooltip>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-border">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-medium text-foreground">
                {selectedList?.name ?? t("favorites.favoriteServers")}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedList
                  ? t("favorites.savedServers", {
                      count: serversForSelectedList.length,
                    })
                  : t("favorites.noLists")}
              </p>
            </div>
            {selectedList ? (
              <AlertDialog
                open={deleteListOpen && selectedList != null}
                onOpenChange={setDeleteListOpen}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        setDeleteListOpen(true);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-[200]">
                    {t("favorites.deleteList")}
                  </TooltipContent>
                </Tooltip>
                <AlertDialogContent size="sm">
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                      <Trash2 className="size-8" />
                    </AlertDialogMedia>
                    <AlertDialogTitle>
                      {t("favorites.deleteDialogTitle")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("favorites.deleteDialogDescription", {
                        list: selectedList.name,
                      })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>
                      {t("favorites.deleteDialogCancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => {
                        if (
                          selectedList &&
                          deleteList(selectedList.id)
                        ) {
                          setDeleteListOpen(false);
                          toast.success(
                            t("favorites.toasts.listDeleted", {
                              list: selectedList.name,
                            })
                          );
                          return;
                        }

                        setDeleteListOpen(false);
                      }}
                    >
                      {t("favorites.deleteList")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>

          <div className="min-h-[18rem] flex-1">
            {!selectedList ? (
              <div className="flex h-full items-center justify-center px-4 py-6">
                <p className="text-sm text-muted-foreground">
                  {t("favorites.noLists")}
                </p>
              </div>
            ) : serversForSelectedList.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-6">
                <p className="text-sm text-muted-foreground">
                  {t("favorites.noServers")}
                </p>
              </div>
            ) : (
              <ServerList
                servers={serversForSelectedList}
                filters={emptyFilters}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                onRefresh={onRefresh}
                error={error}
                actionMode="edit"
                favoriteListId={selectedList.id}
                onOpenServer={onOpenServer}
                onJoinServer={onJoinServer}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
