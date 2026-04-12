import { config } from "../config.js";

type CachedQlStatsElo = {
  cachedAt: number;
  value: number | null;
};

const qlstatsEloCache = new Map<string, CachedQlStatsElo>();
const qlstatsEloTtlMs = 1000 * 60 * 10;
const qlstatsEloRequestTimeoutMs = 4000;

function asRecord(value: unknown) {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isUsefulQlStatsElo(value: number | null) {
  return value != null && Number.isFinite(value) && value > 0 && value !== 1500;
}

function getQlStatsMode(queueName: string, queueSlug: string) {
  const normalized = `${queueSlug} ${queueName}`.toLowerCase();

  if (normalized.includes("ctf")) {
    return "ctf";
  }

  if (normalized.includes("tdm2v2") || normalized.includes("2v2 tdm")) {
    return "tdm2v2";
  }

  if (normalized.includes("tdm")) {
    return "tdm";
  }

  if (normalized.includes("ad")) {
    return "ad";
  }

  if (normalized.includes("ft")) {
    return "ft";
  }

  return "ca";
}

function getQlStatsEloUrl(steamId: string) {
  const template = config.trueskillUrlTemplate;
  if (!template) {
    return null;
  }

  return template.includes("%s")
    ? template.replace("%s", steamId)
    : `${template.replace(/\/+$/, "")}/${steamId}`;
}

function extractModeElo(value: unknown, mode: string) {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const playerInfo = asRecord(record.playerinfo);
  if (playerInfo) {
    for (const playerEntry of Object.values(playerInfo)) {
      const ratings = asRecord(asRecord(playerEntry)?.ratings);
      const modeEntry = asRecord(ratings?.[mode]);
      const elo = readNumber(modeEntry?.elo);
      if (isUsefulQlStatsElo(elo)) {
        return elo;
      }
    }
  }

  const players = Array.isArray(record.players) ? record.players : [];
  for (const playerEntry of players) {
    const modeEntry = asRecord(asRecord(playerEntry)?.[mode]);
    const elo = readNumber(modeEntry?.elo);
    if (isUsefulQlStatsElo(elo)) {
      return elo;
    }
  }

  return null;
}

export async function fetchPickupQlStatsElo({
  queueName,
  queueSlug,
  steamId,
}: {
  queueName: string;
  queueSlug: string;
  steamId: string;
}) {
  const mode = getQlStatsMode(queueName, queueSlug);
  const cacheKey = `${mode}:${steamId}`;
  const cached = qlstatsEloCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt <= qlstatsEloTtlMs) {
    return cached.value;
  }

  const url = getQlStatsEloUrl(steamId);
  if (!url) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), qlstatsEloRequestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      qlstatsEloCache.set(cacheKey, { cachedAt: Date.now(), value: null });
      return null;
    }

    const payload = (await response.json()) as unknown;
    const value = extractModeElo(payload, mode);
    qlstatsEloCache.set(cacheKey, { cachedAt: Date.now(), value });
    return value;
  } catch {
    qlstatsEloCache.set(cacheKey, { cachedAt: Date.now(), value: null });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
