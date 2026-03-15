import { invoke } from "@tauri-apps/api/core";
import { getMapEntry, mapEntries } from "@/lib/maps";
import type { PageId } from "@/lib/navigation";
import type { SteamServer } from "@/lib/steam";

export type DiscordPresenceState = "idle" | "browsing" | "in_server";

export type DiscordPresenceServerContext = {
  server: SteamServer;
  modeLabel: string | null;
};

const discordApplicationId =
  import.meta.env.VITE_DISCORD_APPLICATION_ID?.trim() ?? "";

const mapAssetKeys = Object.fromEntries(
  mapEntries.map((entry) => [entry.id.toLowerCase(), entry.id.toLowerCase()])
) satisfies Record<string, string>;

function getPagePresenceState(page: PageId) {
  switch (page) {
    case "favorites":
      return "Favorites";
    case "notifications":
      return "Notifications";
    case "settings":
      return "Settings";
    case "server-list":
    default:
      return "Server List";
  }
}

function getMapAsset(mapId: string | null | undefined) {
  if (!mapId) {
    return {
      image: null,
      text: null,
    };
  }

  const normalizedMapId = mapId.trim();
  const mapEntry = getMapEntry(normalizedMapId);
  const key =
    mapAssetKeys[normalizedMapId.toLowerCase()] ??
    normalizedMapId.toLowerCase();

  return {
    image: key,
    text: mapEntry?.name ?? normalizedMapId,
  };
}

export function isDiscordPresenceConfigured() {
  return discordApplicationId.length > 0;
}

export async function initializeDiscordPresence() {
  if (!isDiscordPresenceConfigured()) {
    return false;
  }

  try {
    return await invoke<boolean>("initialize_discord_presence", {
      applicationId: discordApplicationId,
    });
  } catch {
    return false;
  }
}

export async function setDiscordBrowsingPresence(page: PageId) {
  if (!isDiscordPresenceConfigured()) {
    return;
  }

  try {
    await invoke("set_discord_browsing_presence", {
      applicationId: discordApplicationId,
      details: "Browsing QLTracker",
      state: getPagePresenceState(page),
      largeImage: "",
      largeText: "",
    });
  } catch {
    // Ignore Discord RPC failures to keep the app fully functional.
  }
}

export async function setDiscordServerPresence(
  context: DiscordPresenceServerContext
) {
  if (!isDiscordPresenceConfigured()) {
    return;
  }

  const { server, modeLabel } = context;
  const mapAsset = getMapAsset(server.map);
  const playerSummary = `${server.players}/${server.max_players}`;
  const state = modeLabel ? `${modeLabel} - ${playerSummary}` : playerSummary;

  try {
    await invoke("set_discord_server_presence", {
      applicationId: discordApplicationId,
      details: stripServerName(server.name),
      state,
      largeImage: mapAsset.image ?? "",
      largeText: mapAsset.text ?? "",
    });
  } catch {
    // Ignore Discord RPC failures to keep the app fully functional.
  }
}

export async function clearDiscordPresence() {
  if (!isDiscordPresenceConfigured()) {
    return;
  }

  try {
    await invoke("clear_discord_presence", {
      applicationId: discordApplicationId,
    });
  } catch {
    // Ignore Discord RPC failures to keep the app fully functional.
  }
}

function stripServerName(name: string) {
  return name.replace(/\^[0-9]/g, "").trim() || "QLTracker";
}
