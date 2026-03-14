type LevelshotModule = {
  default: string;
};

const levelshotModules = import.meta.glob<LevelshotModule>(
  "@/assets/images/levelshots/*.{jpg,jpeg,png,webp}",
  {
    eager: true,
  },
);

export type MapEntry = {
  id: string;
  name: string;
  image: string;
};

function toDisplayName(id: string) {
  return id
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export const mapEntries: MapEntry[] = Object.entries(levelshotModules)
  .map(([path, module]) => {
    const fileName = path.split("/").pop() ?? "";
    const id = fileName.replace(/\.[^.]+$/, "");

    return {
      id,
      name: toDisplayName(id),
      image: module.default,
    };
  })
  .sort((left, right) => left.name.localeCompare(right.name));

export const mapLookup = Object.fromEntries(
  mapEntries.map((entry) => [entry.id, entry]),
) satisfies Record<string, MapEntry>;

export function getMapEntry(mapId: string | null | undefined) {
  if (!mapId) {
    return null;
  }

  const directMatch = mapLookup[mapId];
  if (directMatch) {
    return directMatch;
  }

  const fallbackImage = mapLookup.default?.image;
  if (!fallbackImage) {
    return null;
  }

  return {
    id: mapId,
    name: mapId,
    image: fallbackImage,
  };
}
