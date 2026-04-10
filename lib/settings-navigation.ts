import type { ComponentType } from "react";
import { Download, Flag, Languages } from "lucide-react";

export type SettingsSectionId = "general" | "pickup-profile" | "import-data";

export type SettingsNavigationItem = {
  description: string;
  icon: ComponentType<{ className?: string }>;
  id: SettingsSectionId;
  title: string;
};

export const settingsNavigationItems: readonly SettingsNavigationItem[] = [
  {
    description: "Theme and web app behavior.",
    icon: Languages,
    id: "general",
    title: "General",
  },
  {
    description:
      "Customize the country flag shown next to your player identity across pickup pages.",
    icon: Flag,
    id: "pickup-profile",
    title: "Pickup Profile",
  },
  {
    description: "Import favorites and watchlist data exported from QTracker.",
    icon: Download,
    id: "import-data",
    title: "Import Data",
  },
];
