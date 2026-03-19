import type { ComponentType } from "react";
import { Discord } from "@/components/icon";
import {
  BellRing,
  Languages,
  MessageSquareMore,
  Rocket,
} from "lucide-react";

export type SettingsSectionId =
  | "general"
  | "startup-tray"
  | "desktop-alerts"
  | "notifications"
  | "discord-presence";

export type SettingsNavigationItem = {
  id: SettingsSectionId;
  titleKey: string;
  descriptionKey: string;
  icon: ComponentType<{ className?: string }>;
};

export const SETTINGS_SECTION_STORAGE_KEY = "qltracker-settings-section";

export const settingsNavigationItems: readonly SettingsNavigationItem[] = [
  {
    id: "general",
    titleKey: "settings.sections.general",
    descriptionKey: "settings.sections.generalDescription",
    icon: Languages,
  },
  {
    id: "startup-tray",
    titleKey: "settings.sections.startupTray",
    descriptionKey: "settings.sections.startupTrayDescription",
    icon: Rocket,
  },
  {
    id: "desktop-alerts",
    titleKey: "settings.sections.desktopAlerts",
    descriptionKey: "settings.sections.desktopAlertsDescription",
    icon: BellRing,
  },
  {
    id: "notifications",
    titleKey: "settings.sections.notifications",
    descriptionKey: "settings.sections.notificationsDescription",
    icon: MessageSquareMore,
  },
  {
    id: "discord-presence",
    titleKey: "settings.sections.discordPresence",
    descriptionKey: "settings.sections.discordPresenceDescription",
    icon: Discord,
  },
];

export function parseSettingsSection(value: string): SettingsSectionId {
  const normalizedValue = value.trim();

  if (
    normalizedValue === "general" ||
    normalizedValue === "startup-tray" ||
    normalizedValue === "desktop-alerts" ||
    normalizedValue === "notifications" ||
    normalizedValue === "discord-presence"
  ) {
    return normalizedValue;
  }

  return "general";
}
