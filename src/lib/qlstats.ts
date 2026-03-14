export type QlStatsDocumentData = {
  STEAM_ID?: string;
  NAME?: string;
  CLIENT_NAME?: string;
  NICK?: string;
  COUNTRY?: string;
  SERVER?: string;
  SERVER_NAME?: string;
  MATCH_GUID?: string;
};

export type QlStatsPlayerDocument = {
  DATA?: QlStatsDocumentData;
  [key: string]: unknown;
};

export type QlStatsOnlinePlayer = {
  steamId: string;
  name: string;
  country: string | null;
  serverName: string | null;
};

export type QlStatsServerPlayer = {
  steamId: string | null;
  name: string;
  points: number | null;
  time: number | null;
};

export type QlStatsServerPlayersResponse = {
  ok: boolean;
  serverinfo?: {
    server?: string;
    gt?: string;
    map?: string;
    hostname?: string;
    [key: string]: unknown;
  };
  players?: Array<Record<string, unknown>>;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function toOnlinePlayer(document: QlStatsPlayerDocument): QlStatsOnlinePlayer | null {
  const data = document.DATA;
  if (!data) {
    return null;
  }

  const steamId = getString(data.STEAM_ID);
  if (!steamId) {
    return null;
  }

  return {
    steamId,
    name:
      getString(data.NAME) ??
      getString(data.CLIENT_NAME) ??
      getString(data.NICK) ??
      steamId,
    country: getString(data.COUNTRY),
    serverName: getString(data.SERVER_NAME) ?? getString(data.SERVER),
  };
}

export async function fetchQlStatsOnlinePlayers(baseUrl: string) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/players/online`);

  if (!response.ok) {
    throw new Error(`QLStats request failed with ${response.status}`);
  }

  const payload = (await response.json()) as QlStatsPlayerDocument[];

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map(toOnlinePlayer).filter((player): player is QlStatsOnlinePlayer => player !== null);
}

export async function fetchQlStatsServerPlayers(baseUrl: string, serverAddress: string) {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/server/${encodeURIComponent(serverAddress)}/players`,
  );

  if (!response.ok) {
    throw new Error(`QLStats server request failed with ${response.status}`);
  }

  const payload = (await response.json()) as QlStatsServerPlayersResponse;
  const players = Array.isArray(payload.players) ? payload.players : [];

  return {
    ok: payload.ok,
    serverinfo: payload.serverinfo ?? {},
    players: players.map((player) => ({
      steamId: getString(player.steamid),
      name:
        getString(player.name) ??
        getString(player.nick) ??
        getString(player.client_name) ??
        "Unknown player",
      points:
        getNumber(player.score) ??
        getNumber(player.points) ??
        getNumber(player.frags),
      time:
        getNumber(player.time) ??
        getNumber(player.duration) ??
        getNumber(player.duration_seconds) ??
        getNumber(player.playtime),
    })),
  };
}
