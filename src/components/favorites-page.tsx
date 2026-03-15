import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  createDefaultServerFilters,
  type ServerFiltersValue,
} from "@/components/server-filters";
import { Headset } from "@/components/icon";
import { useFavorites } from "@/hooks/use-favorites";
import { ServerList } from "@/components/server-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SteamServer } from "@/lib/steam";

const emptyFilters: ServerFiltersValue = createDefaultServerFilters();

export function FavoritesPage({
  servers,
  isLoading = false,
  isRefreshing = false,
  error = null,
  onRefresh,
}: {
  servers: SteamServer[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  const { state, createList } = useFavorites();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [createListOpen, setCreateListOpen] = useState(false);

  const selectedList =
    state.lists.find((list) => list.id === selectedListId) ??
    state.lists[0] ??
    null;

  useEffect(() => {
    if (state.lists.length === 0) {
      if (selectedListId !== null) {
        setSelectedListId(null);
      }
      return;
    }

    if (
      !selectedListId ||
      !state.lists.some((list) => list.id === selectedListId)
    ) {
      setSelectedListId(state.lists[0].id);
    }
  }, [selectedListId, state.lists]);

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
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium text-foreground">Lists</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
          <Dialog open={createListOpen} onOpenChange={setCreateListOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">Create List</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Favorite List</DialogTitle>
                <DialogDescription>
                  Create a list to organize your saved servers.
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
                placeholder="List name"
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
                  Create List
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {state.lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => setSelectedListId(list.id)}
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
                      <Headset className="size-3" />
                      <span>{playerCountsByList[list.id] ?? 0}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Total live players in this list
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
                {selectedList?.name ?? "Favorite Servers"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedList
                  ? `${serversForSelectedList.length} saved server${serversForSelectedList.length === 1 ? "" : "s"}`
                  : "Create a list to start saving servers."}
              </p>
            </div>
          </div>

          <div className="min-h-[18rem] flex-1">
            {!selectedList ? (
              <div className="flex h-full items-center justify-center px-4 py-6">
                <p className="text-sm text-muted-foreground">
                  No lists yet. Create your first list to get started.
                </p>
              </div>
            ) : serversForSelectedList.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-6">
                <p className="text-sm text-muted-foreground">
                  No servers saved in this list yet.
                </p>
              </div>
            ) : (
              <ServerList
                servers={serversForSelectedList}
                filters={emptyFilters}
                isLoading={isLoading}
                isRefreshing={isRefreshing}
                error={error}
                actionMode="edit"
                favoriteListId={selectedList.id}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
