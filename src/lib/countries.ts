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
