import {
  createDefaultServerFilters,
  type ServerFiltersValue,
} from "@/lib/server-filters";

export const SERVER_FILTERS_STORAGE_KEY = "qltracker-server-filters";

export function parseStoredServerFilters(rawValue: string): ServerFiltersValue {
  const defaults = createDefaultServerFilters();

  try {
    const parsed = JSON.parse(rawValue) as
      | (Partial<ServerFiltersValue> & {
          hideEmpty?: boolean;
          hideFull?: boolean;
        })
      | null;

    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    const ratingRange = Array.isArray(parsed.ratingRange)
      ? parsed.ratingRange
      : null;

    return {
      search: typeof parsed.search === "string" ? parsed.search : defaults.search,
      region: typeof parsed.region === "string" ? parsed.region : defaults.region,
      visibility:
        parsed.visibility === "all" ||
        parsed.visibility === "public" ||
        parsed.visibility === "private"
          ? parsed.visibility
          : defaults.visibility,
      maps: Array.isArray(parsed.maps)
        ? parsed.maps.filter(
            (value): value is string => typeof value === "string"
          )
        : defaults.maps,
      gameMode:
        typeof parsed.gameMode === "string"
          ? parsed.gameMode
          : defaults.gameMode,
      ratingSystem:
        parsed.ratingSystem === "qelo" || parsed.ratingSystem === "trueskill"
          ? parsed.ratingSystem
          : defaults.ratingSystem,
      ratingRange: [
        typeof ratingRange?.[0] === "number"
          ? ratingRange[0]
          : defaults.ratingRange[0],
        typeof ratingRange?.[1] === "number"
          ? ratingRange[1]
          : defaults.ratingRange[1],
      ],
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.filter(
            (value): value is string => typeof value === "string"
          )
        : defaults.tags,
      showEmpty:
        typeof parsed.showEmpty === "boolean"
          ? parsed.showEmpty
          : defaults.showEmpty,
      showFull:
        typeof parsed.showFull === "boolean"
          ? parsed.showFull
          : typeof parsed.hideEmpty === "boolean"
            ? parsed.hideEmpty
            : defaults.showFull,
      showFavorites:
        typeof parsed.showFavorites === "boolean"
          ? parsed.showFavorites
          : defaults.showFavorites,
    };
  } catch {
    return defaults;
  }
}

export function serializeServerFilters(filters: ServerFiltersValue) {
  return JSON.stringify(filters);
}
