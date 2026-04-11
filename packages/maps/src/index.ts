import mapIds from "./map-ids.json" with { type: "json" };

export type MapEntry = {
  id: string;
  image: string;
  name: string;
};

export function normalizeMapKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^workshop\/\d+\//, "")
    .replace(/^baseq3\/maps\//, "")
    .replace(/^maps\//, "")
    .replace(/\.bsp$/, "");
}

export function toCompactMapKey(value: string) {
  return normalizeMapKey(value).replace(/[\s_-]+/g, "");
}

export function toDisplayName(id: string) {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const mapEntries: MapEntry[] = (mapIds as string[]).map((id) => ({
  id,
  image: `/images/levelshots/${id}.jpg`,
  name: toDisplayName(id),
}));

export const mapLookup = Object.fromEntries(
  mapEntries.map((entry) => [entry.id, entry]),
) satisfies Record<string, MapEntry>;

const normalizedMapLookup = Object.fromEntries(
  mapEntries.flatMap((entry) => [
    [normalizeMapKey(entry.id), entry],
    [toCompactMapKey(entry.id), entry],
    [normalizeMapKey(entry.name), entry],
    [toCompactMapKey(entry.name), entry],
  ]),
) satisfies Record<string, MapEntry>;

export function getMapEntry(mapId: string | null | undefined) {
  if (!mapId) {
    return null;
  }

  const directMatch = mapLookup[mapId];
  if (directMatch) {
    return directMatch;
  }

  const normalizedMatch =
    normalizedMapLookup[normalizeMapKey(mapId)] ??
    normalizedMapLookup[toCompactMapKey(mapId)];

  if (normalizedMatch) {
    return normalizedMatch;
  }

  const fallbackEntry =
    normalizedMapLookup.default ??
    normalizedMapLookup[normalizeMapKey("default")] ??
    mapLookup.default ??
    mapEntries[0];

  if (!fallbackEntry) {
    return null;
  }

  return {
    id: mapId,
    image: fallbackEntry.image,
    name: toDisplayName(normalizeMapKey(mapId) || mapId),
  };
}
