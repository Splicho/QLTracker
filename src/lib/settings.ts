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
] as const;

export type AppLanguage = (typeof SUPPORTED_APP_LANGUAGES)[number];

export type AppSettingsValue = {
  language: AppLanguage;
};

export const APP_SETTINGS_STORAGE_KEY = "qltracker-app-settings";

export function createDefaultAppSettings(): AppSettingsValue {
  return {
    language: "en",
  };
}

export function parseStoredAppSettings(rawValue: string): AppSettingsValue {
  const defaults = createDefaultAppSettings();

  try {
    const parsed = JSON.parse(rawValue) as Partial<AppSettingsValue> | null;
    if (!parsed || typeof parsed !== "object") {
      return defaults;
    }

    return {
      language:
        typeof parsed.language === "string" &&
        SUPPORTED_APP_LANGUAGES.includes(parsed.language as AppLanguage)
          ? (parsed.language as AppLanguage)
          : defaults.language,
    };
  } catch {
    return defaults;
  }
}

export function serializeAppSettings(settings: AppSettingsValue) {
  return JSON.stringify(settings);
}
