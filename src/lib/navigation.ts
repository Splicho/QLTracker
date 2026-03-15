import { HeartOutline, ServerStack } from "@/components/icon";

export const navigationItems = [
  { id: "server-list", titleKey: "navigation.serverList", icon: ServerStack },
  { id: "favorites", titleKey: "navigation.favorites", icon: HeartOutline },
] as const;

export type PageId =
  | (typeof navigationItems)[number]["id"]
  | "notifications"
  | "settings";
