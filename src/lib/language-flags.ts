import type { AppLanguage } from "@/lib/settings";

const flagModules = import.meta.glob("../assets/images/flags/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const flagLookup = Object.fromEntries(
  Object.entries(flagModules).map(([path, src]) => {
    const fileName = path.split("/").pop() ?? "";
    const id = fileName.replace(/\.png$/i, "").toLowerCase();
    return [id, src];
  })
) as Record<string, string>;

const LANGUAGE_FLAG_IDS: Record<AppLanguage, string> = {
  en: "gb",
  de: "de",
  bg: "bg",
  ru: "ru",
  uk: "ua",
  hr: "hr",
  sr: "rs",
  fr: "fr",
  it: "it",
  et: "et",
  nl: "nl",
  fi: "fi",
  sv: "se",
  hu: "hu",
  da: "dk",
  lv: "lv",
  nb: "no",
  ja: "jp",
  ko: "kr",
  ka: "ge",
  "zh-Hant": "tw",
  "zh-Hans": "cn",
  es: "es",
  "pt-BR": "br",
  pl: "pl",
  ro: "ro",
  lt: "lt",
  cs: "cz",
};

export function getLanguageFlagSrc(language: AppLanguage) {
  const flagId = LANGUAGE_FLAG_IDS[language];
  return flagLookup[flagId] ?? flagLookup.none ?? null;
}
