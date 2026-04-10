export const FAVORITES_STORAGE_KEY = "qtracker-favorites"

export type FavoriteList = {
  id: string
  name: string
  createdAt: string
}

export type FavoriteServer = {
  addr: string
  name: string
  map: string
  addedAt: string
  listIds: string[]
}

export type FavoritesState = {
  lists: FavoriteList[]
  servers: FavoriteServer[]
}

export const DEFAULT_FAVORITES_STATE: FavoritesState = {
  lists: [],
  servers: [],
}

export function parseFavoritesState(value: string): FavoritesState {
  try {
    const parsed = JSON.parse(value) as Partial<FavoritesState>
    const parsedLists = Array.isArray(parsed.lists)
      ? parsed.lists.filter(isFavoriteList)
      : []
    const parsedServers = Array.isArray(parsed.servers)
      ? parsed.servers.filter(isFavoriteServer)
      : []
    const migratedLists = parsedLists.filter(
      (list) => !isLegacyDefaultList(list)
    )
    const migratedServers = parsedServers.map((server) => ({
      ...server,
      listIds: server.listIds.filter((listId) => listId !== "default"),
    }))

    return {
      lists: migratedLists,
      servers: migratedServers,
    }
  } catch {
    return DEFAULT_FAVORITES_STATE
  }
}

export function serializeFavoritesState(state: FavoritesState) {
  return JSON.stringify(state)
}

export function countServersForList(state: FavoritesState, listId: string) {
  return state.servers.filter((server) => server.listIds.includes(listId))
    .length
}

function isFavoriteList(value: unknown): value is FavoriteList {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.createdAt === "string"
  )
}

function isFavoriteServer(value: unknown): value is FavoriteServer {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.addr === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.map === "string" &&
    typeof candidate.addedAt === "string" &&
    Array.isArray(candidate.listIds) &&
    candidate.listIds.every((listId) => typeof listId === "string")
  )
}

function isLegacyDefaultList(list: FavoriteList) {
  return list.id === "default" && list.name === "Favorites"
}
