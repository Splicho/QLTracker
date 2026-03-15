import { useMemo } from "react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import {
  APP_SETTINGS_STORAGE_KEY,
  createDefaultAppSettings,
  parseStoredAppSettings,
  serializeAppSettings,
  type AppSettingsValue,
} from "@/lib/settings";

export function useAppSettings() {
  const [rawSettings, setRawSettings] = useLocalStorage(
    APP_SETTINGS_STORAGE_KEY,
    serializeAppSettings(createDefaultAppSettings())
  );
  const settings = useMemo(
    () => parseStoredAppSettings(rawSettings),
    [rawSettings]
  );

  return {
    settings,
    setSettings(next: AppSettingsValue) {
      setRawSettings(serializeAppSettings(next));
    },
    updateSettings(patch: Partial<AppSettingsValue>) {
      setRawSettings(
        serializeAppSettings({
          ...settings,
          ...patch,
        })
      );
    },
  };
}
