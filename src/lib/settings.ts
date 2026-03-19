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
  discordPresenceEnabled: boolean;
  discordPresenceShowServerDetails: boolean;
  discordPresenceSteamId: string;
  trayEnabled: boolean;
  closeToTray: boolean;
  startMinimizedToTray: boolean;
  desktopAlertsEnabled: boolean;
  desktopAlertsPaused: boolean;
  desktopAlertsTrackedPlayers: boolean;
  desktopAlertsFavoriteServers: boolean;
  favoriteServerAlertMinPlayers: number;
};

export const APP_SETTINGS_STORAGE_KEY = "qltracker-app-settings";

export const MIN_FAVORITE_SERVER_ALERT_PLAYERS = 1;
export const MAX_FAVORITE_SERVER_ALERT_PLAYERS = 63;

function normalizeFavoriteServerAlertMinPlayers(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 2;
  }

  return Math.min(
    MAX_FAVORITE_SERVER_ALERT_PLAYERS,
    Math.max(MIN_FAVORITE_SERVER_ALERT_PLAYERS, Math.round(value))
  );
}

export function createDefaultAppSettings(): AppSettingsValue {
  return {
    language: "en",
    discordPresenceEnabled: false,
    discordPresenceShowServerDetails: false,
    discordPresenceSteamId: "",
    trayEnabled: false,
    closeToTray: true,
    startMinimizedToTray: false,
    desktopAlertsEnabled: false,
    desktopAlertsPaused: false,
    desktopAlertsTrackedPlayers: true,
    desktopAlertsFavoriteServers: true,
    favoriteServerAlertMinPlayers: 2,
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
      discordPresenceEnabled:
        typeof parsed.discordPresenceEnabled === "boolean"
          ? parsed.discordPresenceEnabled
          : defaults.discordPresenceEnabled,
      discordPresenceShowServerDetails:
        typeof parsed.discordPresenceShowServerDetails === "boolean"
          ? parsed.discordPresenceShowServerDetails
          : defaults.discordPresenceShowServerDetails,
      discordPresenceSteamId:
        typeof parsed.discordPresenceSteamId === "string"
          ? parsed.discordPresenceSteamId
          : defaults.discordPresenceSteamId,
      trayEnabled:
        typeof parsed.trayEnabled === "boolean"
          ? parsed.trayEnabled
          : defaults.trayEnabled,
      closeToTray:
        typeof parsed.closeToTray === "boolean"
          ? parsed.closeToTray
          : defaults.closeToTray,
      startMinimizedToTray:
        typeof parsed.startMinimizedToTray === "boolean"
          ? parsed.startMinimizedToTray
          : defaults.startMinimizedToTray,
      desktopAlertsEnabled:
        typeof parsed.desktopAlertsEnabled === "boolean"
          ? parsed.desktopAlertsEnabled
          : defaults.desktopAlertsEnabled,
      desktopAlertsPaused:
        typeof parsed.desktopAlertsPaused === "boolean"
          ? parsed.desktopAlertsPaused
          : defaults.desktopAlertsPaused,
      desktopAlertsTrackedPlayers:
        typeof parsed.desktopAlertsTrackedPlayers === "boolean"
          ? parsed.desktopAlertsTrackedPlayers
          : defaults.desktopAlertsTrackedPlayers,
      desktopAlertsFavoriteServers:
        typeof parsed.desktopAlertsFavoriteServers === "boolean"
          ? parsed.desktopAlertsFavoriteServers
          : defaults.desktopAlertsFavoriteServers,
      favoriteServerAlertMinPlayers: normalizeFavoriteServerAlertMinPlayers(
        parsed.favoriteServerAlertMinPlayers
      ),
    };
  } catch {
    return defaults;
  }
}

export function serializeAppSettings(settings: AppSettingsValue) {
  return JSON.stringify(settings);
}
