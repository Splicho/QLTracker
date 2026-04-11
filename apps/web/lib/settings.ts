export const SUPPORTED_APP_LANGUAGES = [
  "en",
  "de",
  "bg",
  "ru",
  "uk",
  "hr",
  "sr",
  "fr",
  "it",
  "et",
  "nl",
  "fi",
  "sv",
  "hu",
  "da",
  "lv",
  "nb",
  "ja",
  "ko",
  "ka",
  "zh-Hant",
  "zh-Hans",
  "es",
  "pt-BR",
  "pl",
  "ro",
  "lt",
  "cs",
] as const

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number]

export const DEFAULT_APP_LANGUAGE: AppLanguage = "en"
export const APP_LANGUAGE_STORAGE_KEY = "qltracker-language"

export function isSupportedAppLanguage(
  value: string | null | undefined
): value is AppLanguage {
  return SUPPORTED_APP_LANGUAGES.includes(value as AppLanguage)
}
