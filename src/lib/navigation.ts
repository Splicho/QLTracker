import { HeartOutline, ServerStack } from "@/components/icon";

export const navigationItems = [
  { id: "server-list", title: "Server List", icon: ServerStack },
  { id: "favorites", title: "Favorites", icon: HeartOutline },
] as const;

export type PageId =
  | (typeof navigationItems)[number]["id"]
  | "notifications";
