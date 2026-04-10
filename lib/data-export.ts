import {
  parseFavoritesState,
  type FavoritesState,
  serializeFavoritesState,
} from "@/lib/favorites";
import {
  parseTrackedPlayers,
  serializeTrackedPlayers,
  type TrackedPlayer,
} from "@/lib/tracked-players";

const DATA_EXPORT_FORMAT = "qltracker-data-export";
const DATA_EXPORT_VERSION = 1;

export type QLTrackerDataExport = {
  format: typeof DATA_EXPORT_FORMAT;
  version: typeof DATA_EXPORT_VERSION;
  exportedAt: string;
  favorites: FavoritesState;
  trackedPlayers: TrackedPlayer[];
};

export function createQLTrackerDataExport({
  favorites,
  trackedPlayers,
}: {
  favorites: FavoritesState;
  trackedPlayers: TrackedPlayer[];
}): QLTrackerDataExport {
  return {
    format: DATA_EXPORT_FORMAT,
    version: DATA_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    favorites,
    trackedPlayers,
  };
}

export function serializeQLTrackerDataExport(data: QLTrackerDataExport) {
  return JSON.stringify(
    {
      ...data,
      favorites: JSON.parse(serializeFavoritesState(data.favorites)),
      trackedPlayers: JSON.parse(serializeTrackedPlayers(data.trackedPlayers)),
    },
    null,
    2
  );
}

export function parseQLTrackerDataExport(rawValue: string): QLTrackerDataExport | null {
  try {
    const parsed = JSON.parse(rawValue) as Partial<QLTrackerDataExport>;
    if (
      !parsed ||
      parsed.format !== DATA_EXPORT_FORMAT ||
      parsed.version !== DATA_EXPORT_VERSION ||
      typeof parsed.exportedAt !== "string"
    ) {
      return null;
    }

    return {
      format: DATA_EXPORT_FORMAT,
      version: DATA_EXPORT_VERSION,
      exportedAt: parsed.exportedAt,
      favorites: parseFavoritesState(JSON.stringify(parsed.favorites ?? {})),
      trackedPlayers: parseTrackedPlayers(JSON.stringify(parsed.trackedPlayers ?? [])),
    };
  } catch {
    return null;
  }
}
