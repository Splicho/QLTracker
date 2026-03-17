import { Eye, HeartOutline, ServerStack } from "@/components/icon";

export const navigationItems = [
  { id: "server-list", titleKey: "navigation.serverList", icon: ServerStack },
  { id: "favorites", titleKey: "navigation.favorites", icon: HeartOutline },
  { id: "watchlist", titleKey: "navigation.watchlist", icon: Eye },
] as const;

export type PageId =
  | (typeof navigationItems)[number]["id"]
  | "notifications"
  | "settings";
