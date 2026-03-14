const flagModules = import.meta.glob("../assets/images/flags/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export type ServerCountryLocation = {
  addr: string;
  ip: string;
  country_name: string | null;
  country_code: string | null;
};

export type ServerRegion = "eu" | "na" | "sa" | "za" | "apac";

const regionCountryCodes: Record<ServerRegion, Set<string>> = {
  eu: new Set([
    "ad",
    "al",
    "am",
    "at",
    "ax",
    "az",
    "ba",
    "be",
    "bg",
    "by",
    "ch",
    "cy",
    "cz",
    "de",
    "dk",
    "ee",
    "es",
    "fi",
    "fo",
    "fr",
    "gb",
    "ge",
    "gg",
    "gi",
    "gr",
    "hr",
    "hu",
    "ie",
    "im",
    "is",
    "it",
    "je",
    "kg",
    "li",
    "lt",
    "lu",
    "lv",
    "mc",
    "md",
    "me",
    "mk",
    "mt",
    "nl",
    "no",
    "pl",
    "pt",
    "ro",
    "rs",
    "ru",
    "se",
    "si",
    "sj",
    "sk",
    "sm",
    "tr",
    "ua",
    "va",
    "xk",
  ]),
  na: new Set([
    "ag",
    "aw",
    "bb",
    "bm",
    "bq",
    "bs",
    "bz",
    "ca",
    "cr",
    "cu",
    "cw",
    "dm",
    "do",
    "gd",
    "gl",
    "gt",
    "hn",
    "ht",
    "jm",
    "kn",
    "ky",
    "lc",
    "mf",
    "mq",
    "ms",
    "mx",
    "ni",
    "pa",
    "pr",
    "sv",
    "sx",
    "tc",
    "tt",
    "us",
    "vc",
    "vg",
    "vi",
  ]),
  sa: new Set([
    "ar",
    "bo",
    "br",
    "cl",
    "co",
    "ec",
    "fk",
    "gf",
    "gy",
    "pe",
    "py",
    "sr",
    "uy",
    "ve",
  ]),
  za: new Set(["za"]),
  apac: new Set([
    "as",
    "au",
    "bd",
    "bn",
    "cn",
    "ck",
    "fj",
    "gu",
    "hk",
    "id",
    "in",
    "jp",
    "kh",
    "kr",
    "la",
    "lk",
    "mm",
    "mn",
    "mo",
    "mp",
    "my",
    "nc",
    "np",
    "nz",
    "pf",
    "pg",
    "ph",
    "pk",
    "sb",
    "sg",
    "th",
    "tl",
    "to",
    "tw",
    "vn",
    "vu",
    "ws",
  ]),
};

const flagLookup = Object.fromEntries(
  Object.entries(flagModules).map(([path, src]) => {
    const fileName = path.split("/").pop() ?? "";
    const id = fileName.replace(/\.png$/i, "").toLowerCase();
    return [id, src];
  }),
) as Record<string, string>;

export function getCountryFlagSrc(countryCode: string | null | undefined) {
  if (!countryCode) {
    return flagLookup.none ?? null;
  }

  return flagLookup[countryCode.toLowerCase()] ?? flagLookup.none ?? null;
}

export function getRegionFromCountryCode(
  countryCode: string | null | undefined,
): ServerRegion | null {
  const normalizedCode = countryCode?.trim().toLowerCase();

  if (!normalizedCode) {
    return null;
  }

  for (const [region, codes] of Object.entries(regionCountryCodes) as Array<
    [ServerRegion, Set<string>]
  >) {
    if (codes.has(normalizedCode)) {
      return region;
    }
  }

  return null;
}
