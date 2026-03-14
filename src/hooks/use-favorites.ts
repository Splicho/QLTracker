import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  countServersForList,
  DEFAULT_FAVORITES_STATE,
  FAVORITES_STORAGE_KEY,
  type FavoriteServer,
  parseFavoritesState,
  serializeFavoritesState,
  type FavoritesState,
} from "@/lib/favorites";

export function useFavorites() {
  const [rawValue, setRawValue] = useLocalStorage(
    FAVORITES_STORAGE_KEY,
    serializeFavoritesState(DEFAULT_FAVORITES_STATE),
  );

  const state = useMemo(() => parseFavoritesState(rawValue), [rawValue]);

  function setState(nextState: FavoritesState) {
    setRawValue(serializeFavoritesState(nextState));
  }

  function createList(name: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const normalizedName = trimmedName.toLowerCase();
    if (state.lists.some((list) => list.name.toLowerCase() === normalizedName)) {
      return;
    }

    setState({
      ...state,
      lists: [
        ...state.lists,
        {
          id: crypto.randomUUID(),
          name: trimmedName,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  function addServerToList(server: Omit<FavoriteServer, "addedAt" | "listIds">, listId: string) {
    if (!state.lists.some((list) => list.id === listId)) {
      return;
    }

    const existingServer = state.servers.find((entry) => entry.addr === server.addr);

    if (!existingServer) {
      setState({
        ...state,
        servers: [
          ...state.servers,
          {
            ...server,
            addedAt: new Date().toISOString(),
            listIds: [listId],
          },
        ],
      });
      return;
    }

    if (existingServer.listIds.includes(listId)) {
      return;
    }

    setState({
      ...state,
      servers: state.servers.map((entry) =>
        entry.addr === server.addr
          ? {
              ...entry,
              listIds: [...entry.listIds, listId],
            }
          : entry,
      ),
    });
  }

  function moveServerToList(addr: string, fromListId: string, toListId: string) {
    if (fromListId === toListId || !state.lists.some((list) => list.id === toListId)) {
      return;
    }

    setState({
      ...state,
      servers: state.servers.map((entry) => {
        if (entry.addr !== addr) {
          return entry;
        }

        const nextListIds = entry.listIds.filter((listId) => listId !== fromListId);
        if (!nextListIds.includes(toListId)) {
          nextListIds.push(toListId);
        }

        return {
          ...entry,
          listIds: nextListIds,
        };
      }),
    });
  }

  function removeServerFromList(addr: string, listId: string) {
    setState({
      ...state,
      servers: state.servers
        .map((entry) =>
          entry.addr === addr
            ? {
                ...entry,
                listIds: entry.listIds.filter((entryListId) => entryListId !== listId),
              }
            : entry,
        )
        .filter((entry) => entry.listIds.length > 0),
    });
  }

  return {
    state,
    createList,
    addServerToList,
    moveServerToList,
    removeServerFromList,
    countServersForList: (listId: string) => countServersForList(state, listId),
  };
}
