import { queryServerPlayers, type A2sPlayer } from "./a2s.js";
import { config } from "./config.js";
import type { ServerSnapshot } from "./types.js";

type QlStatsServerResponse = {
  players?: Array<Record<string, unknown>>;
  serverinfo?: {
    gt?: string | null;
  } | null;
};

type CachedTrueskill = {
  cachedAt: number;
  value: number | null;
};

type QlStatsPlayer = {
  name: string;
  qelo: number | null;
  steamId: string | null;
  team: number | null;
};

type LivePlayerMatch = A2sPlayer & {
  comparableName: string;
  matchedQlStatsPlayer: QlStatsPlayer | null;
  visibleName: string;
};

type ScoredMatchCandidate = {
  durationDiff: number;
  liveIndex: number;
  qlstatsIndex: number;
  score: number;
};

const trueskillCache = new Map<string, CachedTrueskill>();
const trueskillTtlMs = 1000 * 60 * 5;

function qlstatsValueAsString(
  value: Record<string, unknown>,
  key: string
): string | null {
  const field = value[key];

  return typeof field === "string" && field.trim().length > 0
    ? field.trim()
    : null;
}

function qlstatsValueAsNumber(
  value: Record<string, unknown>,
  key: string
): number | null {
  const field = value[key];

  if (typeof field === "number" && Number.isFinite(field)) {
    return field;
  }

  if (typeof field === "string") {
    const parsed = Number(field.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function extractFirstPlausibleNumber(input: string) {
  const matches = input.match(/-?\d+(?:\.\d+)?/g) ?? [];

  for (const match of matches) {
    const value = Number(match);
    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 10000 &&
      value !== 1500
    ) {
      return value;
    }
  }

  return null;
}

function extractRatingNumber(input: string) {
  const lowered = input.toLowerCase();
  const keywords = ["trueskill", "rating", "elo", "mu"];

  for (const keyword of keywords) {
    const index = lowered.indexOf(keyword);
    if (index !== -1) {
      const value = extractFirstPlausibleNumber(
        lowered.slice(index + keyword.length)
      );
      if (value != null) {
        return value;
      }
    }
  }

  return extractFirstPlausibleNumber(lowered);
}

async function fetchTrueskill(steamId: string) {
  const cached = trueskillCache.get(steamId);
  if (cached && Date.now() - cached.cachedAt <= trueskillTtlMs) {
    return cached.value;
  }

  const template = config.trueskillUrlTemplate;
  if (!template) {
    return null;
  }

  const url = template.includes("%s")
    ? template.replace("%s", steamId)
    : `${template.replace(/\/+$/, "")}/${steamId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      trueskillCache.set(steamId, { cachedAt: Date.now(), value: null });
      return null;
    }

    const body = await response.text();
    let value: number | null = null;

    try {
      const json = JSON.parse(body) as unknown;
      if (typeof json === "number" && Number.isFinite(json)) {
        value = json;
      } else if (json && typeof json === "object") {
        for (const key of ["elo", "trueskill", "rating", "mu"]) {
          const field = (json as Record<string, unknown>)[key];
          if (typeof field === "number" && Number.isFinite(field)) {
            value = field;
            break;
          }
          if (typeof field === "string") {
            const parsed = Number(field.trim());
            if (Number.isFinite(parsed)) {
              value = parsed;
              break;
            }
          }
        }
      }
    } catch {
      value = extractRatingNumber(body);
    }

    trueskillCache.set(steamId, { cachedAt: Date.now(), value });
    return value;
  } catch {
    return null;
  }
}

function calculateAverage(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => value != null);
  if (numbers.length === 0) {
    return null;
  }

  return Math.round(
    numbers.reduce((total, value) => total + value, 0) / numbers.length
  );
}

function stripQuakeColors(value: string) {
  return value.replace(/\^\d/g, "");
}

function trimTrailingResetColors(value: string) {
  return value.replace(/(?:\^7)+$/g, "");
}

function normalizeComparableName(value: string) {
  return trimTrailingResetColors(value.trim());
}

function normalizeVisibleName(value: string) {
  return stripQuakeColors(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function parseQlStatsPlayers(players: Array<Record<string, unknown>>) {
  return players.map<QlStatsPlayer>((player) => ({
    name:
      qlstatsValueAsString(player, "name") ??
      qlstatsValueAsString(player, "nick") ??
      qlstatsValueAsString(player, "client_name") ??
      "Unknown player",
    qelo:
      qlstatsValueAsNumber(player, "rating") ??
      qlstatsValueAsNumber(player, "elo"),
    steamId:
      qlstatsValueAsString(player, "steamid") ??
      qlstatsValueAsString(player, "steam_id"),
    team: qlstatsValueAsNumber(player, "team"),
  }));
}

function getElapsedSeconds(
  currentSnapshot: ServerSnapshot,
  previousSnapshot: ServerSnapshot | null
) {
  if (!previousSnapshot?.updatedAt || !currentSnapshot.updatedAt) {
    return null;
  }

  const elapsedMs =
    Date.parse(currentSnapshot.updatedAt) - Date.parse(previousSnapshot.updatedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return null;
  }

  return elapsedMs / 1000;
}

function matchByField(
  livePlayers: LivePlayerMatch[],
  qlstatsPlayers: QlStatsPlayer[],
  field: "comparableName" | "visibleName"
) {
  const remainingQlstatsPlayers = qlstatsPlayers.map((player, index) => ({
    comparableName: normalizeComparableName(player.name),
    index,
    player,
    visibleName: normalizeVisibleName(player.name),
  }));

  for (const livePlayer of livePlayers) {
    if (livePlayer.matchedQlStatsPlayer != null) {
      continue;
    }

    const matchIndex = remainingQlstatsPlayers.findIndex(
      (candidate) =>
        candidate.player.steamId !== null &&
        candidate[field] !== "" &&
        candidate[field] === livePlayer[field]
    );
    if (matchIndex === -1) {
      continue;
    }

    livePlayer.matchedQlStatsPlayer = remainingQlstatsPlayers[matchIndex]!.player;
    remainingQlstatsPlayers.splice(matchIndex, 1);
  }
}

function matchUsingPreviousSnapshot(
  livePlayers: LivePlayerMatch[],
  qlstatsPlayers: QlStatsPlayer[],
  currentSnapshot: ServerSnapshot,
  previousSnapshot: ServerSnapshot | null
) {
  if (!previousSnapshot) {
    return;
  }

  const elapsedSeconds = getElapsedSeconds(currentSnapshot, previousSnapshot);
  const previousPlayersBySteamId = new Map(
    previousSnapshot.playersInfo
      .filter(
        (
          player
        ): player is typeof player & {
          steamId: string;
        } => typeof player.steamId === "string" && player.steamId.length > 0
      )
      .map((player) => [player.steamId, player] as const)
  );
  const candidates: ScoredMatchCandidate[] = [];

  for (const [qlstatsIndex, qlstatsPlayer] of qlstatsPlayers.entries()) {
    if (
      qlstatsPlayer.steamId == null ||
      livePlayers.some(
        (livePlayer) => livePlayer.matchedQlStatsPlayer === qlstatsPlayer
      )
    ) {
      continue;
    }

    const previousPlayer = previousPlayersBySteamId.get(qlstatsPlayer.steamId);
    if (!previousPlayer) {
      continue;
    }

    const expectedDurationSeconds =
      elapsedSeconds == null
        ? previousPlayer.durationSeconds
        : previousPlayer.durationSeconds + elapsedSeconds;
    const previousVisibleName = normalizeVisibleName(previousPlayer.name);

    for (const [liveIndex, livePlayer] of livePlayers.entries()) {
      if (livePlayer.matchedQlStatsPlayer != null) {
        continue;
      }

      const durationDiff = Math.abs(
        livePlayer.durationSeconds - expectedDurationSeconds
      );
      const scoreDiff = Math.abs(livePlayer.score - previousPlayer.score);
      const visibleNamePenalty =
        previousVisibleName !== "" && livePlayer.visibleName === previousVisibleName
          ? 0
          : 5;

      candidates.push({
        durationDiff,
        liveIndex,
        qlstatsIndex,
        score: durationDiff + scoreDiff * 4 + visibleNamePenalty,
      });
    }
  }

  const maxDurationDiff =
    elapsedSeconds == null ? 45 : Math.max(45, elapsedSeconds * 2 + 20);

  for (const candidate of candidates.sort((left, right) => left.score - right.score)) {
    const livePlayer = livePlayers[candidate.liveIndex];
    const qlstatsPlayer = qlstatsPlayers[candidate.qlstatsIndex];
    if (
      !livePlayer ||
      !qlstatsPlayer ||
      livePlayer.matchedQlStatsPlayer != null ||
      livePlayers.some(
        (player) => player.matchedQlStatsPlayer === qlstatsPlayer
      ) ||
      candidate.durationDiff > maxDurationDiff
    ) {
      continue;
    }

    livePlayer.matchedQlStatsPlayer = qlstatsPlayer;
  }
}

function mergePlayerInfo(
  snapshot: ServerSnapshot,
  previousSnapshot: ServerSnapshot | null,
  livePlayers: A2sPlayer[],
  qlstatsPlayers: QlStatsPlayer[]
) {
  if (livePlayers.length === 0 && qlstatsPlayers.length === 0) {
    return [];
  }

  if (livePlayers.length === 0) {
    return qlstatsPlayers.map((player) => ({
      durationSeconds: 0,
      name: player.name,
      qelo: player.qelo,
      score: 0,
      steamId: player.steamId,
      team: player.team,
      trueskill: null,
    }));
  }

  if (qlstatsPlayers.length === 0) {
    return livePlayers.map((player) => ({
      durationSeconds: player.durationSeconds,
      name: player.name,
      qelo: null,
      score: player.score,
      steamId: null,
      team: null,
      trueskill: null,
    }));
  }

  const liveMatches = livePlayers.map<LivePlayerMatch>((player) => ({
    ...player,
    comparableName: normalizeComparableName(player.name),
    matchedQlStatsPlayer: null,
    visibleName: normalizeVisibleName(player.name),
  }));

  matchByField(liveMatches, qlstatsPlayers, "comparableName");
  matchByField(liveMatches, qlstatsPlayers, "visibleName");
  matchUsingPreviousSnapshot(
    liveMatches,
    qlstatsPlayers,
    snapshot,
    previousSnapshot
  );

  const unmatchedLivePlayers = liveMatches.filter(
    (player) => player.matchedQlStatsPlayer == null
  );
  const unmatchedQlstatsPlayers = qlstatsPlayers.filter(
    (qlstatsPlayer) =>
      !liveMatches.some(
        (livePlayer) => livePlayer.matchedQlStatsPlayer === qlstatsPlayer
      )
  );

  if (unmatchedLivePlayers.length === 1 && unmatchedQlstatsPlayers.length === 1) {
    unmatchedLivePlayers[0]!.matchedQlStatsPlayer = unmatchedQlstatsPlayers[0]!;
  } else if (
    unmatchedLivePlayers.length > 0 &&
    unmatchedLivePlayers.length === unmatchedQlstatsPlayers.length
  ) {
    // Last-resort fallback: preserve live A2S names and keep the metadata aligned
    // by remaining order rather than duplicating players or dropping SteamIDs.
    unmatchedLivePlayers.forEach((livePlayer, index) => {
      livePlayer.matchedQlStatsPlayer = unmatchedQlstatsPlayers[index] ?? null;
    });
  }

  return liveMatches.map((livePlayer) => ({
    durationSeconds: livePlayer.durationSeconds,
    name: livePlayer.name,
    qelo: livePlayer.matchedQlStatsPlayer?.qelo ?? null,
    score: livePlayer.score,
    steamId: livePlayer.matchedQlStatsPlayer?.steamId ?? null,
    team: livePlayer.matchedQlStatsPlayer?.team ?? null,
    trueskill: null,
  }));
}

async function enrichSnapshot(
  snapshot: ServerSnapshot,
  previousSnapshot: ServerSnapshot | null
) {
  if (snapshot.players <= 0) {
    return snapshot;
  }

  const [livePlayersResult, qlstatsPayloadResult] = await Promise.allSettled([
    queryServerPlayers(snapshot.addr),
    fetch(`${config.qlstatsApiUrl}/server/${encodeURIComponent(snapshot.addr)}/players`),
  ]);

  const livePlayers =
    livePlayersResult.status === "fulfilled" ? livePlayersResult.value : [];
  if (livePlayersResult.status === "rejected") {
    console.warn(
      `A2S player query failed for ${snapshot.addr}:`,
      livePlayersResult.reason
    );
  }

  let qlstatsPayload: QlStatsServerResponse | null = null;
  if (qlstatsPayloadResult.status === "fulfilled") {
    const response = qlstatsPayloadResult.value;
    if (response.ok) {
      qlstatsPayload = (await response.json()) as QlStatsServerResponse;
    }
  } else {
    console.warn(
      `QLStats player request failed for ${snapshot.addr}:`,
      qlstatsPayloadResult.reason
    );
  }

  const qlstatsPlayers = parseQlStatsPlayers(qlstatsPayload?.players ?? []);
  const playersInfo = mergePlayerInfo(
    snapshot,
    previousSnapshot,
    livePlayers,
    qlstatsPlayers
  );
  const playersWithTrueskill = await Promise.all(
    playersInfo.map(async (player) => ({
      ...player,
      trueskill: player.steamId ? await fetchTrueskill(player.steamId) : null,
    }))
  );

  return {
    ...snapshot,
    avgQelo: calculateAverage(playersWithTrueskill.map((player) => player.qelo)),
    avgTrueskill: calculateAverage(
      playersWithTrueskill.map((player) => player.trueskill)
    ),
    gameMode: qlstatsPayload?.serverinfo?.gt ?? snapshot.gameMode ?? null,
    playersInfo: playersWithTrueskill,
  };
}

export async function enrichSnapshots(
  snapshots: ServerSnapshot[],
  previousSnapshotsByAddr: ReadonlyMap<string, ServerSnapshot> = new Map()
) {
  const results: ServerSnapshot[] = [];
  const chunkSize = 8;

  for (let index = 0; index < snapshots.length; index += chunkSize) {
    const chunk = snapshots.slice(index, index + chunkSize);
    const enrichedChunk = await Promise.all(
      chunk.map(async (snapshot) => {
        try {
          return await enrichSnapshot(
            snapshot,
            previousSnapshotsByAddr.get(snapshot.addr) ?? null
          );
        } catch {
          return snapshot;
        }
      })
    );

    results.push(...enrichedChunk);
  }

  return results;
}
