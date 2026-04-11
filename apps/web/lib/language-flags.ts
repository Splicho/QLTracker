import type { AppLanguage } from "@/lib/settings"

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
  et: "ee",
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
}

export function getLanguageFlagSrc(language: AppLanguage) {
  return `/images/flags/${LANGUAGE_FLAG_IDS[language]}.png`
}
