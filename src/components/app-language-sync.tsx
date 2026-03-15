import { useEffect } from "react";
import i18n from "@/i18n";
import { useAppSettings } from "@/hooks/use-app-settings";

export function AppLanguageSync() {
  const { settings } = useAppSettings();

  useEffect(() => {
    void i18n.changeLanguage(settings.language);
  }, [settings.language]);

  return null;
}
