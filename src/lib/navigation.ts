import { ServerStack, Star } from "@/components/icon";

export const navigationItems = [
  { id: "server-list", title: "Server List", icon: ServerStack },
  { id: "favorites", title: "Favorites", icon: Star },
] as const;

export type PageId = (typeof navigationItems)[number]["id"];
