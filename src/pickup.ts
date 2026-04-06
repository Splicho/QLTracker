import crypto from "node:crypto";
import type express from "express";
import type { Server, Socket } from "socket.io";
import { Rating, TrueSkill } from "ts-trueskill";
import { config } from "./config.js";
import { pool } from "./db.js";
import { lookupCountry } from "./geolite.js";

const DEFAULT_QUEUE = {
  description: "Seasonal 4v4 Clan Arena pickup queue.",
  name: "4v4 CA",
  playerCount: 8,
  readyCheckDurationSeconds: 30,
  slug: "4v4-ca",
  teamSize: 4,
  vetoTurnDurationSeconds: 20,
};

const DEFAULT_MAP_POOL = [
  ["campgrounds", "Campgrounds"],
  ["bloodrun", "Blood Run"],
  ["furiousheights", "Furious Heights"],
  ["hektik", "Hektik"],
  ["grimdungeons", "Grim Dungeons"],
  ["verticalvengeance", "Vertical Vengeance"],
  ["thunderstruck", "Thunderstruck"],
] as const;

const ratingEnv = new TrueSkill(1000, 150, 75, 5, 0);

type PickupQueueRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  teamSize: number;
  playerCount: number;
  readyCheckDurationSeconds: number;
  vetoTurnDurationSeconds: number;
  enabled: boolean;
  provisionApiUrl: string | null;
  provisionAuthToken: string | null;
  callbackSecret: string | null;
};

type PickupSeasonRow = {
  id: string;
  queueId: string;
  name: string;
  status: "draft" | "active" | "completed";
  durationPreset: "one_month" | "three_month" | "custom";
  startsAt: Date;
  endsAt: Date;
};

type PickupPlayerIdentity = {
  avatarUrl: string | null;
  id: string;
  personaName: string;
  profileUrl: string | null;
  steamId: string;
};

type PickupSessionIdentity = {
  player: PickupPlayerIdentity;
  sessionId: string;
  token: string;
};

type PickupRatingRow = {
  displayRating: number;
  gamesPlayed: number;
  losses: number;
  mu: number;
  playerId: string;
  sigma: number;
  wins: number;
};

type PickupQueueMemberRow = PickupPlayerIdentity & {
  id: string;
  joinedAt: Date;
  playerId: string;
};

type PickupVetoTurn = {
  captainPlayerId: string;
  mapKey: string;
  order: number;
  reason: "captain" | "timeout";
};

type PickupVetoState = {
  availableMaps: string[];
  bannedMaps: string[];
  turns: PickupVetoTurn[];
  turnCaptainPlayerId: string | null;
};

type PickupBalanceSummary = {
  captainPlayerIds: {
    left: string;
    right: string;
  };
  ratingDelta: number;
  teamRatings: {
    left: number;
    right: number;
  };
};

type PickupMatchRow = {
  id: string;
  queueId: string;
  seasonId: string;
  status:
    | "ready_check"
    | "veto"
    | "provisioning"
    | "server_ready"
    | "live"
    | "completed"
    | "cancelled";
  readyDeadlineAt: Date | null;
  vetoDeadlineAt: Date | null;
  currentCaptainPlayerId: string | null;
  finalMapKey: string | null;
  bannedMapKeys: string[] | null;
  vetoState: PickupVetoState | null;
  balanceSummary: PickupBalanceSummary | null;
  provisionPayload: Record<string, unknown> | null;
  resultPayload: Record<string, unknown> | null;
  serverIp: string | null;
  serverPort: number | null;
  serverJoinAddress: string | null;
  serverLocationCountryCode: string | null;
  serverLocationCountryName: string | null;
  serverProvisionedAt: Date | null;
  liveStartedAt: Date | null;
  completedAt: Date | null;
  winnerTeam: "left" | "right" | null;
  finalScore: string | null;
  createdAt: Date;
};

type PickupMatchPlayerRow = PickupPlayerIdentity & {
  id: string;
  matchId: string;
  playerId: string;
  joinedAt: Date;
  readyState: "pending" | "ready" | "dropped";
  readyConfirmedAt: Date | null;
  team: "left" | "right" | null;
  isCaptain: boolean;
  muBefore: number;
  sigmaBefore: number;
  displayBefore: number;
  muAfter: number | null;
  sigmaAfter: number | null;
  displayAfter: number | null;
  won: boolean | null;
};

type PickupPublicState = {
  queue: {
    currentPlayers: number;
    description: string | null;
    enabled: boolean;
    id: string;
    name: string;
    playerCount: number;
    readyCheckDurationSeconds: number;
    slug: string;
    teamSize: number;
    vetoTurnDurationSeconds: number;
  };
  season: {
    endsAt: string;
    id: string;
    name: string;
    startsAt: string;
    status: string;
  } | null;
};

type PickupPlayerRatingState = {
  displayRating: number;
  gamesPlayed: number;
  losses: number;
  mu: number;
  sigma: number;
  wins: number;
} | null;

type PickupPlayerCard = {
  avatarUrl: string | null;
  displayAfter: number | null;
  displayBefore: number;
  id: string;
  isCaptain: boolean;
  joinedAt: string;
  personaName: string;
  profileUrl: string | null;
  readyConfirmedAt: string | null;
  readyState: "pending" | "ready" | "dropped";
  steamId: string;
  team: "left" | "right" | null;
  won: boolean | null;
};

type PickupMatchState = {
  balanceSummary: PickupBalanceSummary | null;
  completedAt: string | null;
  finalMapKey: string | null;
  finalScore: string | null;
  id: string;
  liveStartedAt: string | null;
  queueId: string;
  readyDeadlineAt: string | null;
  seasonId: string;
  server: {
    countryCode: string | null;
    countryName: string | null;
    ip: string | null;
    joinAddress: string | null;
    port: number | null;
    provisionedAt: string | null;
  };
  status: PickupMatchRow["status"];
  teams: {
    left: PickupPlayerCard[];
    right: PickupPlayerCard[];
  };
  veto: {
    availableMaps: string[];
    bannedMaps: string[];
    currentCaptainPlayerId: string | null;
    deadlineAt: string | null;
    turns: PickupVetoTurn[];
  };
  winnerTeam: "left" | "right" | null;
};

type PickupPlayerState =
  | {
      publicState: PickupPublicState;
      rating: PickupPlayerRatingState;
      stage: "idle";
      viewer: PickupPlayerIdentity;
    }
  | {
      publicState: PickupPublicState;
      queue: {
        joinedAt: string;
        playerCount: number;
        queueId: string;
        queueSlug: string;
      };
      rating: PickupPlayerRatingState;
      stage: "queue";
      viewer: PickupPlayerIdentity;
    }
  | {
      match: PickupMatchState;
      publicState: PickupPublicState;
      rating: PickupPlayerRatingState;
      stage:
        | "ready_check"
        | "veto"
        | "provisioning"
        | "server_ready"
        | "live"
        | "completed";
      viewer: PickupPlayerIdentity;
    };

type RawBodyRequest = express.Request & {
  rawBody?: string;
};

function hashPickupToken(token: string) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`pickup:${token}`)
    .digest("hex");
}

function defaultDisplayRating(mu: number) {
  return Math.max(0, Math.round(mu));
}

function ratingToState(rating: PickupRatingRow | null): PickupPlayerRatingState {
  if (!rating) {
    return null;
  }

  return {
    displayRating: rating.displayRating,
    gamesPlayed: rating.gamesPlayed,
    losses: rating.losses,
    mu: rating.mu,
    sigma: rating.sigma,
    wins: rating.wins,
  };
}

function toPlayerCard(player: PickupMatchPlayerRow): PickupPlayerCard {
  return {
    avatarUrl: player.avatarUrl,
    displayAfter: player.displayAfter,
    displayBefore: player.displayBefore,
    id: player.playerId,
    isCaptain: player.isCaptain,
    joinedAt: player.joinedAt.toISOString(),
    personaName: player.personaName,
    profileUrl: player.profileUrl,
    readyConfirmedAt: player.readyConfirmedAt?.toISOString() ?? null,
    readyState: player.readyState,
    steamId: player.steamId,
    team: player.team,
    won: player.won,
  };
}

function parseJson<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  return value as T;
}

function createSignature(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
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
        lowered.slice(index + keyword.length),
      );
      if (value != null) {
        return value;
      }
    }
  }

  return extractFirstPlausibleNumber(lowered);
}

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function extractTrueskillFromJson(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  for (const key of ["elo", "trueskill", "rating", "mu"]) {
    const field = record[key];
    if (typeof field === "number" && Number.isFinite(field)) {
      return field;
    }

    if (typeof field === "string") {
      const parsed = Number(field.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

async function fetchExternalSeedRating(steamId: string) {
  const template = config.trueskillUrlTemplate.trim();
  if (!template) {
    return null;
  }

  const url = template.includes("%s")
    ? template.replace("%s", steamId)
    : `${template.replace(/\/+$/, "")}/${steamId}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as unknown;
      return extractTrueskillFromJson(parsed) ?? extractRatingNumber(body);
    } catch {
      return extractRatingNumber(body);
    }
  } catch {
    return null;
  }
}

function createRating(mu: number, sigma: number) {
  return ratingEnv.createRating(mu, sigma);
}

function combinations<T>(values: T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }

  if (values.length < size) {
    return [];
  }

  if (values.length === size) {
    return [values];
  }

  const [head, ...tail] = values;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
}

function compareByRating(
  left: PickupQueueMemberRow & { rating: PickupRatingRow },
  right: PickupQueueMemberRow & { rating: PickupRatingRow },
) {
  if (right.rating.displayRating !== left.rating.displayRating) {
    return right.rating.displayRating - left.rating.displayRating;
  }

  if (left.joinedAt.getTime() !== right.joinedAt.getTime()) {
    return left.joinedAt.getTime() - right.joinedAt.getTime();
  }

  return left.playerId.localeCompare(right.playerId);
}

function chooseBalancedTeams(
  members: Array<PickupQueueMemberRow & { rating: PickupRatingRow }>,
) {
  const seeded = [...members].sort(compareByRating);
  const leftSeed = seeded[0]!;
  const rightSeed = seeded[1]!;
  const remaining = seeded.slice(2);
  const leftSlots = DEFAULT_QUEUE.teamSize - 1;
  const splits = combinations(remaining, leftSlots);
  let best: {
    delta: number;
    left: Array<PickupQueueMemberRow & { rating: PickupRatingRow }>;
    right: Array<PickupQueueMemberRow & { rating: PickupRatingRow }>;
  } | null = null;

  for (const leftCombo of splits) {
    const leftIds = new Set(leftCombo.map((member) => member.playerId));
    const left = [leftSeed, ...leftCombo];
    const right = [
      rightSeed,
      ...remaining.filter((member) => !leftIds.has(member.playerId)),
    ];
    const leftRating = left.reduce(
      (total, member) => total + member.rating.displayRating,
      0,
    );
    const rightRating = right.reduce(
      (total, member) => total + member.rating.displayRating,
      0,
    );
    const delta = Math.abs(leftRating - rightRating);

    if (
      !best ||
      delta < best.delta ||
      (delta === best.delta &&
        left.map((member) => member.playerId).join("|") <
          best.left.map((member) => member.playerId).join("|"))
    ) {
      best = { delta, left, right };
    }
  }

  if (!best) {
    throw new Error("Could not balance pickup teams.");
  }

  const leftCaptain =
    best.left[Math.floor(Math.random() * best.left.length)] ?? best.left[0]!;
  const rightCaptain =
    best.right[Math.floor(Math.random() * best.right.length)] ?? best.right[0]!;

  return {
    balanceSummary: {
      captainPlayerIds: {
        left: leftCaptain.playerId,
        right: rightCaptain.playerId,
      },
      ratingDelta: best.delta,
      teamRatings: {
        left: Math.round(
          best.left.reduce(
            (total, member) => total + member.rating.displayRating,
            0,
          ) / best.left.length,
        ),
        right: Math.round(
          best.right.reduce(
            (total, member) => total + member.rating.displayRating,
            0,
          ) / best.right.length,
        ),
      },
    } satisfies PickupBalanceSummary,
    left: best.left,
    right: best.right,
  };
}

export function createPickupService(io: Server) {
  const readyTimers = new Map<string, NodeJS.Timeout>();
  const vetoTimers = new Map<string, NodeJS.Timeout>();

  async function ensureBootstrapData() {
    const queueResult = await pool.query<PickupQueueRow>(
      `
        insert into "PickupQueue" (
          "id",
          "slug",
          "name",
          "description",
          "teamSize",
          "playerCount",
          "readyCheckDurationSeconds",
          "vetoTurnDurationSeconds",
          "enabled",
          "createdAt",
          "updatedAt"
        )
        values (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          true,
          now(),
          now()
        )
        on conflict ("slug") do update
        set
          "name" = excluded."name",
          "description" = excluded."description",
          "teamSize" = excluded."teamSize",
          "playerCount" = excluded."playerCount",
          "readyCheckDurationSeconds" = excluded."readyCheckDurationSeconds",
          "vetoTurnDurationSeconds" = excluded."vetoTurnDurationSeconds",
          "updatedAt" = now()
        returning
          "id",
          "slug",
          "name",
          "description",
          "teamSize",
          "playerCount",
          "readyCheckDurationSeconds",
          "vetoTurnDurationSeconds",
          "enabled",
          "provisionApiUrl",
          "provisionAuthToken",
          "callbackSecret"
      `,
      [
        DEFAULT_QUEUE.slug,
        DEFAULT_QUEUE.name,
        DEFAULT_QUEUE.description,
        DEFAULT_QUEUE.teamSize,
        DEFAULT_QUEUE.playerCount,
        DEFAULT_QUEUE.readyCheckDurationSeconds,
        DEFAULT_QUEUE.vetoTurnDurationSeconds,
      ],
    );

    const queue = queueResult.rows[0]!;

    for (const [index, [mapKey, label]] of DEFAULT_MAP_POOL.entries()) {
      await pool.query(
        `
          insert into "PickupMapPool" (
            "id",
            "queueId",
            "mapKey",
            "label",
            "sortOrder",
            "active",
            "createdAt",
            "updatedAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            true,
            now(),
            now()
          )
          on conflict ("queueId", "mapKey") do nothing
        `,
        [queue.id, mapKey, label, index],
      );
    }

    const seasons = await pool.query<{ count: string }>(
      `select count(*)::text as count from "PickupSeason" where "queueId" = $1`,
      [queue.id],
    );

    if (Number(seasons.rows[0]?.count ?? "0") === 0) {
      await pool.query(
        `
          insert into "PickupSeason" (
            "id",
            "queueId",
            "name",
            "status",
            "durationPreset",
            "startsAt",
            "endsAt",
            "createdAt",
            "updatedAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            'Launch Season',
            'active',
            'one_month',
            now(),
            now() + interval '1 month',
            now(),
            now()
          )
        `,
        [queue.id],
      );
    }

    return queue;
  }

  async function getDefaultQueue() {
    await ensureBootstrapData();
    const result = await pool.query<PickupQueueRow>(
      `
        select
          "id",
          "slug",
          "name",
          "description",
          "teamSize",
          "playerCount",
          "readyCheckDurationSeconds",
          "vetoTurnDurationSeconds",
          "enabled",
          "provisionApiUrl",
          "provisionAuthToken",
          "callbackSecret"
        from "PickupQueue"
        where "slug" = $1
        limit 1
      `,
      [DEFAULT_QUEUE.slug],
    );

    return result.rows[0] ?? null;
  }

  async function getActiveSeason(queueId: string) {
    const result = await pool.query<PickupSeasonRow>(
      `
        select
          "id",
          "queueId",
          "name",
          "status",
          "durationPreset",
          "startsAt",
          "endsAt"
        from "PickupSeason"
        where "queueId" = $1 and "status" = 'active'
        order by "startsAt" desc
        limit 1
      `,
      [queueId],
    );

    return result.rows[0] ?? null;
  }

  async function authenticatePickupSession(token: string) {
    const result = await pool.query<
      PickupSessionIdentity & {
        avatarUrl: string | null;
        profileUrl: string | null;
        personaName: string;
        steamId: string;
        id: string;
      }
    >(
      `
        select
          s."id" as "sessionId",
          p."id" as "id",
          p."steamId" as "steamId",
          p."personaName" as "personaName",
          p."avatarUrl" as "avatarUrl",
          p."profileUrl" as "profileUrl"
        from "PickupAppSession" s
        inner join "PickupPlayer" p on p."id" = s."playerId"
        where
          s."tokenHash" = $1
          and s."revokedAt" is null
          and s."expiresAt" > now()
        limit 1
      `,
      [hashPickupToken(token)],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    await pool.query(
      `update "PickupAppSession" set "lastUsedAt" = now() where "id" = $1`,
      [row.sessionId],
    );

    return {
      player: {
        avatarUrl: row.avatarUrl,
        id: row.id,
        personaName: row.personaName,
        profileUrl: row.profileUrl,
        steamId: row.steamId,
      },
      sessionId: row.sessionId,
      token,
    } satisfies PickupSessionIdentity;
  }

  async function getQueueMembers(queueId: string, limit?: number) {
    const limitClause = limit ? `limit ${limit}` : "";
    const result = await pool.query<PickupQueueMemberRow>(
      `
        select
          qm."id",
          qm."playerId",
          qm."joinedAt",
          p."id",
          p."personaName",
          p."avatarUrl",
          p."profileUrl",
          p."steamId"
        from "PickupQueueMember" qm
        inner join "PickupPlayer" p on p."id" = qm."playerId"
        where qm."queueId" = $1
        order by qm."joinedAt" asc
        ${limitClause}
      `,
      [queueId],
    );

    return result.rows;
  }

  async function getOrCreatePlayerSeasonRating(
    player: PickupPlayerIdentity,
    season: PickupSeasonRow,
  ) {
    const existing = await pool.query<PickupRatingRow>(
      `
        select
          "playerId",
          "mu",
          "sigma",
          "displayRating",
          "gamesPlayed",
          "wins",
          "losses"
        from "PickupPlayerSeasonRating"
        where "seasonId" = $1 and "playerId" = $2
        limit 1
      `,
      [season.id, player.id],
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const seed = await fetchExternalSeedRating(player.steamId);
    const mu = seed ?? ratingEnv.mu;
    const sigma = ratingEnv.sigma;
    const insert = await pool.query<PickupRatingRow>(
      `
        insert into "PickupPlayerSeasonRating" (
          "id",
          "seasonId",
          "playerId",
          "mu",
          "sigma",
          "displayRating",
          "gamesPlayed",
          "wins",
          "losses",
          "seededFrom",
          "createdAt",
          "updatedAt"
        )
        values (
          gen_random_uuid()::text,
          $1,
          $2,
          $3,
          $4,
          $5,
          0,
          0,
          0,
          $6,
          now(),
          now()
        )
        on conflict ("seasonId", "playerId") do update
        set "updatedAt" = now()
        returning
          "playerId",
          "mu",
          "sigma",
          "displayRating",
          "gamesPlayed",
          "wins",
          "losses"
      `,
      [
        season.id,
        player.id,
        mu,
        sigma,
        defaultDisplayRating(mu),
        seed != null ? "qlstats-trueskill" : "default-baseline",
      ],
    );

    return insert.rows[0]!;
  }

  async function getPublicState(): Promise<PickupPublicState> {
    const queue = await getDefaultQueue();
    if (!queue) {
      throw new Error("Pickup queue is unavailable.");
    }

    const [season, queueCount] = await Promise.all([
      getActiveSeason(queue.id),
      pool.query<{ count: string }>(
        `select count(*)::text as count from "PickupQueueMember" where "queueId" = $1`,
        [queue.id],
      ),
    ]);

    return {
      queue: {
        currentPlayers: Number(queueCount.rows[0]?.count ?? "0"),
        description: queue.description,
        enabled: queue.enabled,
        id: queue.id,
        name: queue.name,
        playerCount: queue.playerCount,
        readyCheckDurationSeconds: queue.readyCheckDurationSeconds,
        slug: queue.slug,
        teamSize: queue.teamSize,
        vetoTurnDurationSeconds: queue.vetoTurnDurationSeconds,
      },
      season: season
        ? {
            endsAt: season.endsAt.toISOString(),
            id: season.id,
            name: season.name,
            startsAt: season.startsAt.toISOString(),
            status: season.status,
          }
        : null,
    };
  }

  async function getLatestMatchById(matchId: string) {
    const result = await pool.query<PickupMatchRow>(
      `
        select
          "id",
          "queueId",
          "seasonId",
          "status",
          "readyDeadlineAt",
          "vetoDeadlineAt",
          "currentCaptainPlayerId",
          "finalMapKey",
          "bannedMapKeys",
          "vetoState",
          "balanceSummary",
          "provisionPayload",
          "resultPayload",
          "serverIp",
          "serverPort",
          "serverJoinAddress",
          "serverLocationCountryCode",
          "serverLocationCountryName",
          "serverProvisionedAt",
          "liveStartedAt",
          "completedAt",
          "winnerTeam",
          "finalScore",
          "createdAt"
        from "PickupMatch"
        where "id" = $1
        limit 1
      `,
      [matchId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      balanceSummary: parseJson<PickupBalanceSummary>(row.balanceSummary),
      provisionPayload: parseJson<Record<string, unknown>>(row.provisionPayload),
      resultPayload: parseJson<Record<string, unknown>>(row.resultPayload),
      vetoState: parseJson<PickupVetoState>(row.vetoState),
    };
  }

  async function getLatestPlayerMatch(playerId: string) {
    const result = await pool.query<PickupMatchRow>(
      `
        select
          m."id",
          m."queueId",
          m."seasonId",
          m."status",
          m."readyDeadlineAt",
          m."vetoDeadlineAt",
          m."currentCaptainPlayerId",
          m."finalMapKey",
          m."bannedMapKeys",
          m."vetoState",
          m."balanceSummary",
          m."provisionPayload",
          m."resultPayload",
          m."serverIp",
          m."serverPort",
          m."serverJoinAddress",
          m."serverLocationCountryCode",
          m."serverLocationCountryName",
          m."serverProvisionedAt",
          m."liveStartedAt",
          m."completedAt",
          m."winnerTeam",
          m."finalScore",
          m."createdAt"
        from "PickupMatch" m
        inner join "PickupMatchPlayer" mp on mp."matchId" = m."id"
        where
          mp."playerId" = $1
          and m."status" <> 'cancelled'
        order by m."createdAt" desc
        limit 1
      `,
      [playerId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      balanceSummary: parseJson<PickupBalanceSummary>(row.balanceSummary),
      provisionPayload: parseJson<Record<string, unknown>>(row.provisionPayload),
      resultPayload: parseJson<Record<string, unknown>>(row.resultPayload),
      vetoState: parseJson<PickupVetoState>(row.vetoState),
    };
  }

  async function getMatchPlayers(matchId: string) {
    const result = await pool.query<PickupMatchPlayerRow>(
      `
        select
          mp."id",
          mp."matchId",
          mp."playerId",
          mp."joinedAt",
          mp."readyState",
          mp."readyConfirmedAt",
          mp."team",
          mp."isCaptain",
          mp."muBefore",
          mp."sigmaBefore",
          mp."displayBefore",
          mp."muAfter",
          mp."sigmaAfter",
          mp."displayAfter",
          mp."won",
          p."id",
          p."personaName",
          p."avatarUrl",
          p."profileUrl",
          p."steamId"
        from "PickupMatchPlayer" mp
        inner join "PickupPlayer" p on p."id" = mp."playerId"
        where mp."matchId" = $1
        order by mp."joinedAt" asc, p."personaName" asc
      `,
      [matchId],
    );

    return result.rows;
  }

  async function getPlayerState(
    player: PickupPlayerIdentity,
  ): Promise<PickupPlayerState> {
    const [publicState, queue] = await Promise.all([
      getPublicState(),
      getDefaultQueue(),
    ]);

    if (!queue) {
      throw new Error("Pickup queue is unavailable.");
    }

    const season = await getActiveSeason(queue.id);
    const rating =
      season != null ? await getOrCreatePlayerSeasonRating(player, season) : null;
    const match = await getLatestPlayerMatch(player.id);

    if (match) {
      const matchPlayers = await getMatchPlayers(match.id);
      const left = matchPlayers.filter((member) => member.team === "left");
      const right = matchPlayers.filter((member) => member.team === "right");
      const matchState: PickupMatchState = {
        balanceSummary: match.balanceSummary,
        completedAt: match.completedAt?.toISOString() ?? null,
        finalMapKey: match.finalMapKey,
        finalScore: match.finalScore,
        id: match.id,
        liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
        queueId: match.queueId,
        readyDeadlineAt: match.readyDeadlineAt?.toISOString() ?? null,
        seasonId: match.seasonId,
        server: {
          countryCode: match.serverLocationCountryCode,
          countryName: match.serverLocationCountryName,
          ip: match.serverIp,
          joinAddress: match.serverJoinAddress,
          port: match.serverPort,
          provisionedAt: match.serverProvisionedAt?.toISOString() ?? null,
        },
        status: match.status,
        teams: {
          left: left.map(toPlayerCard),
          right: right.map(toPlayerCard),
        },
        veto: {
          availableMaps: match.vetoState?.availableMaps ?? [],
          bannedMaps: match.vetoState?.bannedMaps ?? [],
          currentCaptainPlayerId: match.vetoState?.turnCaptainPlayerId ?? null,
          deadlineAt: match.vetoDeadlineAt?.toISOString() ?? null,
          turns: match.vetoState?.turns ?? [],
        },
        winnerTeam: match.winnerTeam,
      };

      return {
        match: matchState,
        publicState,
        rating: ratingToState(rating),
        stage: match.status === "cancelled" ? "idle" : match.status,
        viewer: player,
      };
    }

    const membership = await pool.query<{ joinedAt: Date }>(
      `
        select "joinedAt"
        from "PickupQueueMember"
        where "playerId" = $1
        limit 1
      `,
      [player.id],
    );

    const joinedAt = membership.rows[0]?.joinedAt;
    if (joinedAt) {
      return {
        publicState,
        queue: {
          joinedAt: joinedAt.toISOString(),
          playerCount: queue.playerCount,
          queueId: queue.id,
          queueSlug: queue.slug,
        },
        rating: ratingToState(rating),
        stage: "queue",
        viewer: player,
      };
    }

    return {
      publicState,
      rating: ratingToState(rating),
      stage: "idle",
      viewer: player,
    };
  }

  async function emitPlayerState(playerId: string) {
    const identityResult = await pool.query<PickupPlayerIdentity>(
      `
        select
          "id",
          "steamId",
          "personaName",
          "avatarUrl",
          "profileUrl"
        from "PickupPlayer"
        where "id" = $1
        limit 1
      `,
      [playerId],
    );
    const player = identityResult.rows[0];
    if (!player) {
      return;
    }

    const state = await getPlayerState(player);
    io.to(`pickup:player:${playerId}`).emit("pickup:state", state);

    if (state.stage === "queue") {
      io.to(`pickup:player:${playerId}`).emit("pickup:queue:update", state.queue);
    } else if (state.stage === "ready_check" || state.stage === "veto") {
      io.to(`pickup:player:${playerId}`).emit("pickup:lobby:update", state.match);
    } else if (state.stage !== "idle") {
      io.to(`pickup:player:${playerId}`).emit("pickup:match:update", state.match);
    }
  }

  async function broadcastPublicState() {
    const publicState = await getPublicState();
    io.emit("pickup:public-state", publicState);
    io.emit("pickup:queue:update", publicState.queue);
  }

  function clearReadyTimer(matchId: string) {
    const timer = readyTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      readyTimers.delete(matchId);
    }
  }

  function clearVetoTimer(matchId: string) {
    const timer = vetoTimers.get(matchId);
    if (timer) {
      clearTimeout(timer);
      vetoTimers.delete(matchId);
    }
  }

  function scheduleReadyTimer(matchId: string, readyDeadlineAt: Date | null) {
    clearReadyTimer(matchId);
    if (!readyDeadlineAt) {
      return;
    }

    const delay = Math.max(0, readyDeadlineAt.getTime() - Date.now());
    readyTimers.set(
      matchId,
      setTimeout(() => {
        readyTimers.delete(matchId);
        void handleReadyCheckTimeout(matchId);
      }, delay),
    );
  }

  function scheduleVetoTimer(matchId: string, vetoDeadlineAt: Date | null) {
    clearVetoTimer(matchId);
    if (!vetoDeadlineAt) {
      return;
    }

    const delay = Math.max(0, vetoDeadlineAt.getTime() - Date.now());
    vetoTimers.set(
      matchId,
      setTimeout(() => {
        vetoTimers.delete(matchId);
        void handleVetoTimeout(matchId);
      }, delay),
    );
  }

  async function createMatchFromQueue(queue: PickupQueueRow, season: PickupSeasonRow) {
    const members = await getQueueMembers(queue.id, queue.playerCount);
    if (members.length < queue.playerCount) {
      return null;
    }

    const ratedMembers = await Promise.all(
      members.map(async (member) => ({
        ...member,
        rating: await getOrCreatePlayerSeasonRating(
          {
            avatarUrl: member.avatarUrl,
            id: member.playerId,
            personaName: member.personaName,
            profileUrl: member.profileUrl,
            steamId: member.steamId,
          },
          season,
        ),
      })),
    );
    const teams = chooseBalancedTeams(ratedMembers);
    const readyDeadlineAt = new Date(
      Date.now() + queue.readyCheckDurationSeconds * 1000,
    );

    const client = await pool.connect();
    try {
      await client.query("begin");
      const lockedMembers = await client.query<PickupQueueMemberRow>(
        `
          select
            qm."id",
            qm."playerId",
            qm."joinedAt",
            p."id",
            p."personaName",
            p."avatarUrl",
            p."profileUrl",
            p."steamId"
          from "PickupQueueMember" qm
          inner join "PickupPlayer" p on p."id" = qm."playerId"
          where qm."queueId" = $1
          order by qm."joinedAt" asc
          for update
          limit $2
        `,
        [queue.id, queue.playerCount],
      );

      if (lockedMembers.rows.length < queue.playerCount) {
        await client.query("rollback");
        return null;
      }

      const lockedIds = lockedMembers.rows.map((member) => member.id);
      await client.query(
        `delete from "PickupQueueMember" where "id" = any($1::text[])`,
        [lockedIds],
      );

      const matchResult = await client.query<{ id: string }>(
        `
          insert into "PickupMatch" (
            "id",
            "queueId",
            "seasonId",
            "status",
            "readyDeadlineAt",
            "balanceSummary",
            "createdAt",
            "updatedAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            'ready_check',
            $3,
            $4::jsonb,
            now(),
            now()
          )
          returning "id"
        `,
        [queue.id, season.id, readyDeadlineAt, JSON.stringify(teams.balanceSummary)],
      );

      const matchId = matchResult.rows[0]!.id;
      for (const member of ratedMembers) {
        const team = teams.left.some((leftMember) => leftMember.playerId === member.playerId)
          ? "left"
          : "right";
        const isCaptain =
          teams.balanceSummary.captainPlayerIds.left === member.playerId ||
          teams.balanceSummary.captainPlayerIds.right === member.playerId;

        await client.query(
          `
            insert into "PickupMatchPlayer" (
              "id",
              "matchId",
              "playerId",
              "joinedAt",
              "readyState",
              "team",
              "isCaptain",
              "muBefore",
              "sigmaBefore",
              "displayBefore",
              "createdAt",
              "updatedAt"
            )
            values (
              gen_random_uuid()::text,
              $1,
              $2,
              $3,
              'pending',
              $4::"PickupTeamSide",
              $5,
              $6,
              $7,
              $8,
              now(),
              now()
            )
          `,
          [
            matchId,
            member.playerId,
            member.joinedAt,
            team,
            isCaptain,
            member.rating.mu,
            member.rating.sigma,
            member.rating.displayRating,
          ],
        );
      }

      await client.query("commit");
      scheduleReadyTimer(matchId, readyDeadlineAt);
      await broadcastPublicState();
      for (const member of ratedMembers) {
        await emitPlayerState(member.playerId);
      }
      return matchId;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async function tryStartMatchmaking(queueId: string) {
    const queue = await getDefaultQueue();
    if (!queue || queue.id !== queueId || !queue.enabled) {
      return;
    }

    const season = await getActiveSeason(queue.id);
    if (!season) {
      return;
    }

    while (true) {
      const members = await getQueueMembers(queue.id, queue.playerCount);
      if (members.length < queue.playerCount) {
        break;
      }

      const matchId = await createMatchFromQueue(queue, season);
      if (!matchId) {
        break;
      }
    }
  }

  async function requeueReadyPlayers(
    queueId: string,
    readyPlayers: PickupMatchPlayerRow[],
  ) {
    if (readyPlayers.length === 0) {
      return;
    }

    const baseTime = Date.now() - readyPlayers.length * 1000;
    for (const [index, player] of readyPlayers.entries()) {
      await pool.query(
        `
          insert into "PickupQueueMember" (
            "id",
            "queueId",
            "playerId",
            "joinedAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3
          )
          on conflict ("playerId") do nothing
        `,
        [queueId, player.playerId, new Date(baseTime + index * 1000)],
      );
    }
  }

  async function handleReadyCheckTimeout(matchId: string) {
    clearReadyTimer(matchId);
    const match = await getLatestMatchById(matchId);
    if (!match || match.status !== "ready_check") {
      return;
    }

    const players = await getMatchPlayers(matchId);
    const readyPlayers = players.filter((player) => player.readyState === "ready");
    const pendingPlayers = players.filter((player) => player.readyState !== "ready");

    if (pendingPlayers.length === 0) {
      await transitionMatchToVeto(matchId);
      return;
    }

    await requeueReadyPlayers(match.queueId, readyPlayers);
    await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'cancelled',
          "resultPayload" = $2::jsonb,
          "updatedAt" = now()
        where "id" = $1
      `,
      [
        matchId,
        JSON.stringify({
          reason: "ready-check-timeout",
          droppedPlayerIds: pendingPlayers.map((player) => player.playerId),
          requeuedPlayerIds: readyPlayers.map((player) => player.playerId),
        }),
      ],
    );

    await broadcastPublicState();
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    await tryStartMatchmaking(match.queueId);
  }

  async function getActiveMaps(queueId: string) {
    const result = await pool.query<{ mapKey: string }>(
      `
        select "mapKey"
        from "PickupMapPool"
        where "queueId" = $1 and "active" = true
        order by "sortOrder" asc, "label" asc
      `,
      [queueId],
    );

    return result.rows.map((row) => row.mapKey);
  }

  async function transitionMatchToVeto(matchId: string) {
    clearReadyTimer(matchId);
    const match = await getLatestMatchById(matchId);
    if (!match || match.status !== "ready_check") {
      return;
    }

    const players = await getMatchPlayers(matchId);
    if (players.some((player) => player.readyState !== "ready")) {
      return;
    }

    const queue = await getDefaultQueue();
    if (!queue) {
      return;
    }

    const maps = await getActiveMaps(queue.id);
    const balanceSummary = match.balanceSummary;
    if (!balanceSummary) {
      throw new Error("Pickup match is missing captain data.");
    }

    const captainIds = [
      balanceSummary.captainPlayerIds.left,
      balanceSummary.captainPlayerIds.right,
    ];
    const turnCaptainPlayerId =
      captainIds[Math.floor(Math.random() * captainIds.length)] ?? captainIds[0]!;
    const vetoDeadlineAt = new Date(
      Date.now() + queue.vetoTurnDurationSeconds * 1000,
    );
    const vetoState: PickupVetoState = {
      availableMaps: maps,
      bannedMaps: [],
      turnCaptainPlayerId,
      turns: [],
    };

    await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'veto',
          "readyDeadlineAt" = null,
          "vetoDeadlineAt" = $2,
          "currentCaptainPlayerId" = $3,
          "vetoState" = $4::jsonb,
          "updatedAt" = now()
        where "id" = $1
      `,
      [matchId, vetoDeadlineAt, turnCaptainPlayerId, JSON.stringify(vetoState)],
    );

    scheduleVetoTimer(matchId, vetoDeadlineAt);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  async function recordProvisionEvent(
    matchId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    await pool.query(
      `
        insert into "PickupProvisionEvent" (
          "id",
          "matchId",
          "eventType",
          "payload",
          "createdAt"
        )
        values (
          gen_random_uuid()::text,
          $1,
          $2,
          $3::jsonb,
          now()
        )
      `,
      [matchId, eventType, JSON.stringify(payload)],
    );
  }

  async function applyProvisionResult(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const ip =
      typeof payload.ip === "string" && payload.ip.trim().length > 0
        ? payload.ip.trim()
        : null;
    const port =
      typeof payload.port === "number"
        ? payload.port
        : typeof payload.port === "string"
          ? Number(payload.port)
          : null;

    if (!ip || !Number.isFinite(port)) {
      throw new Error("Provision callback must include ip and port.");
    }

    const location = await lookupCountry(ip);
    const joinAddress =
      typeof payload.joinAddress === "string" && payload.joinAddress.trim().length > 0
        ? payload.joinAddress.trim()
        : `${ip}:${port}`;

    await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'server_ready',
          "serverIp" = $2,
          "serverPort" = $3,
          "serverJoinAddress" = $4,
          "serverLocationCountryCode" = $5,
          "serverLocationCountryName" = $6,
          "serverProvisionedAt" = now(),
          "provisionPayload" = coalesce("provisionPayload", '{}'::jsonb) || $7::jsonb,
          "updatedAt" = now()
        where "id" = $1
      `,
      [
        matchId,
        ip,
        port,
        joinAddress,
        typeof payload.countryCode === "string"
          ? payload.countryCode.toLowerCase()
          : location.countryCode,
        typeof payload.countryName === "string"
          ? payload.countryName
          : location.countryName,
        JSON.stringify(payload),
      ],
    );

    await recordProvisionEvent(matchId, "provisioned", payload);
    const players = await getMatchPlayers(matchId);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  async function requestProvision(matchId: string) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status !== "provisioning") {
      return;
    }

    const queue = await getDefaultQueue();
    if (!queue?.provisionApiUrl) {
      await recordProvisionEvent(matchId, "provision-error", {
        error: "Provision API URL is not configured.",
      });
      return;
    }

    const players = await getMatchPlayers(matchId);
    const payload = {
      captains: match.balanceSummary?.captainPlayerIds ?? null,
      finalMapKey: match.finalMapKey,
      matchId: match.id,
      queueId: match.queueId,
      seasonId: match.seasonId,
      teams: {
        left: players
          .filter((player) => player.team === "left")
          .map((player) => ({
            personaName: player.personaName,
            playerId: player.playerId,
            steamId: player.steamId,
          })),
        right: players
          .filter((player) => player.team === "right")
          .map((player) => ({
            personaName: player.personaName,
            playerId: player.playerId,
            steamId: player.steamId,
          })),
      },
    };

    await recordProvisionEvent(matchId, "request", payload);

    try {
      const response = await fetch(queue.provisionApiUrl, {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          ...(queue.provisionAuthToken
            ? {
                Authorization: `Bearer ${queue.provisionAuthToken}`,
              }
            : {}),
        },
        method: "POST",
      });

      const text = await response.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : null;
      } catch {
        parsed = { raw: text };
      }

      await recordProvisionEvent(matchId, "response", {
        ok: response.ok,
        payload: parsed,
        status: response.status,
      });

      if (
        response.ok &&
        parsed &&
        (typeof parsed.ip === "string" || typeof parsed.port === "number")
      ) {
        await applyProvisionResult(matchId, parsed);
      }
    } catch (error) {
      await recordProvisionEvent(matchId, "response-error", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function applyBan(
    matchId: string,
    requestedByPlayerId: string | null,
    requestedMapKey?: string,
    reason: "captain" | "timeout" = "captain",
  ) {
    clearVetoTimer(matchId);
    const match = await getLatestMatchById(matchId);
    if (!match || match.status !== "veto" || !match.vetoState) {
      return;
    }

    const balanceSummary = match.balanceSummary;
    if (!balanceSummary) {
      throw new Error("Pickup match is missing balance data.");
    }

    const vetoState = { ...match.vetoState };
    const currentCaptainPlayerId = vetoState.turnCaptainPlayerId;
    if (!currentCaptainPlayerId) {
      throw new Error("Pickup veto is missing the active captain.");
    }

    if (requestedByPlayerId && requestedByPlayerId !== currentCaptainPlayerId) {
      throw new Error("Only the current captain can ban a map.");
    }

    const mapKey =
      requestedMapKey && vetoState.availableMaps.includes(requestedMapKey)
        ? requestedMapKey
        : vetoState.availableMaps[0];

    if (!mapKey) {
      throw new Error("No maps remain to ban.");
    }

    const availableMaps = vetoState.availableMaps.filter((value) => value !== mapKey);
    const bannedMaps = [...vetoState.bannedMaps, mapKey];
    const turns = [
      ...vetoState.turns,
      {
        captainPlayerId: currentCaptainPlayerId,
        mapKey,
        order: vetoState.turns.length + 1,
        reason,
      },
    ];

    if (availableMaps.length === 1) {
      await pool.query(
        `
          update "PickupMatch"
          set
            "status" = 'provisioning',
            "finalMapKey" = $2,
            "bannedMapKeys" = $3::jsonb,
            "currentCaptainPlayerId" = null,
            "vetoDeadlineAt" = null,
            "vetoState" = $4::jsonb,
            "updatedAt" = now()
          where "id" = $1
        `,
        [
          matchId,
          availableMaps[0],
          JSON.stringify(bannedMaps),
          JSON.stringify({
            availableMaps,
            bannedMaps,
            turnCaptainPlayerId: null,
            turns,
          }),
        ],
      );

      const players = await getMatchPlayers(matchId);
      for (const player of players) {
        await emitPlayerState(player.playerId);
      }
      await requestProvision(matchId);
      return;
    }

    const nextCaptainPlayerId =
      currentCaptainPlayerId === balanceSummary.captainPlayerIds.left
        ? balanceSummary.captainPlayerIds.right
        : balanceSummary.captainPlayerIds.left;
    const queue = await getDefaultQueue();
    if (!queue) {
      return;
    }

    const vetoDeadlineAt = new Date(
      Date.now() + queue.vetoTurnDurationSeconds * 1000,
    );
    await pool.query(
      `
        update "PickupMatch"
        set
          "currentCaptainPlayerId" = $2,
          "vetoDeadlineAt" = $3,
          "bannedMapKeys" = $4::jsonb,
          "vetoState" = $5::jsonb,
          "updatedAt" = now()
        where "id" = $1
      `,
      [
        matchId,
        nextCaptainPlayerId,
        vetoDeadlineAt,
        JSON.stringify(bannedMaps),
        JSON.stringify({
          availableMaps,
          bannedMaps,
          turnCaptainPlayerId: nextCaptainPlayerId,
          turns,
        }),
      ],
    );

    scheduleVetoTimer(matchId, vetoDeadlineAt);
    const players = await getMatchPlayers(matchId);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  async function handleVetoTimeout(matchId: string) {
    await applyBan(matchId, null, undefined, "timeout");
  }

  async function joinQueue(session: PickupSessionIdentity) {
    const queue = await getDefaultQueue();
    if (!queue || !queue.enabled) {
      throw new Error("The pickup queue is currently unavailable.");
    }

    const activeSeason = await getActiveSeason(queue.id);
    if (!activeSeason) {
      throw new Error("No active pickup season is configured.");
    }

    const currentState = await getPlayerState(session.player);
    if (currentState.stage !== "idle") {
      return currentState;
    }

    await getOrCreatePlayerSeasonRating(session.player, activeSeason);
    await pool.query(
      `
        insert into "PickupQueueMember" (
          "id",
          "queueId",
          "playerId",
          "joinedAt"
        )
        values (
          gen_random_uuid()::text,
          $1,
          $2,
          now()
        )
        on conflict ("playerId") do nothing
      `,
      [queue.id, session.player.id],
    );

    await broadcastPublicState();
    await emitPlayerState(session.player.id);
    await tryStartMatchmaking(queue.id);
    return getPlayerState(session.player);
  }

  async function leaveQueue(session: PickupSessionIdentity) {
    await pool.query(`delete from "PickupQueueMember" where "playerId" = $1`, [
      session.player.id,
    ]);

    await broadcastPublicState();
    await emitPlayerState(session.player.id);
    return getPlayerState(session.player);
  }

  async function markReady(session: PickupSessionIdentity) {
    const match = await getLatestPlayerMatch(session.player.id);
    if (!match || match.status !== "ready_check") {
      throw new Error("You are not in an active ready check.");
    }

    await pool.query(
      `
        update "PickupMatchPlayer"
        set
          "readyState" = 'ready',
          "readyConfirmedAt" = now(),
          "updatedAt" = now()
        where "matchId" = $1 and "playerId" = $2
      `,
      [match.id, session.player.id],
    );

    const players = await getMatchPlayers(match.id);
    if (players.every((player) => player.readyState === "ready")) {
      await transitionMatchToVeto(match.id);
    }

    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    return getPlayerState(session.player);
  }

  async function banMap(session: PickupSessionIdentity, mapKey: string) {
    const match = await getLatestPlayerMatch(session.player.id);
    if (!match || match.status !== "veto") {
      throw new Error("You are not in an active veto.");
    }

    await applyBan(match.id, session.player.id, mapKey, "captain");
    return getPlayerState(session.player);
  }

  async function applyMatchResult(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status === "completed" || match.status === "cancelled") {
      return;
    }

    const winnerTeam =
      payload.winnerTeam === "left" || payload.winnerTeam === "right"
        ? payload.winnerTeam
        : null;
    if (!winnerTeam) {
      throw new Error("Result callback must include winnerTeam.");
    }

    const players = await getMatchPlayers(matchId);
    const left = players.filter((player) => player.team === "left");
    const right = players.filter((player) => player.team === "right");
    const rated = ratingEnv.rate(
      [
        left.map((player) => createRating(player.muBefore, player.sigmaBefore)),
        right.map((player) => createRating(player.muBefore, player.sigmaBefore)),
      ],
      winnerTeam === "left" ? [0, 1] : [1, 0],
    ) as Rating[][];
    const [leftRated, rightRated] = rated;

    const client = await pool.connect();
    try {
      await client.query("begin");

      for (const [index, player] of left.entries()) {
        const rating = leftRated[index]!;
        await client.query(
          `
            update "PickupMatchPlayer"
            set
              "muAfter" = $3,
              "sigmaAfter" = $4,
              "displayAfter" = $5,
              "won" = $6,
              "updatedAt" = now()
            where "id" = $1 and "matchId" = $2
          `,
          [
            player.id,
            matchId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "left",
          ],
        );

        await client.query(
          `
            update "PickupPlayerSeasonRating"
            set
              "mu" = $3,
              "sigma" = $4,
              "displayRating" = $5,
              "gamesPlayed" = "gamesPlayed" + 1,
              "wins" = "wins" + $6,
              "losses" = "losses" + $7,
              "updatedAt" = now()
            where "seasonId" = $1 and "playerId" = $2
          `,
          [
            match.seasonId,
            player.playerId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "left" ? 1 : 0,
            winnerTeam === "left" ? 0 : 1,
          ],
        );
      }

      for (const [index, player] of right.entries()) {
        const rating = rightRated[index]!;
        await client.query(
          `
            update "PickupMatchPlayer"
            set
              "muAfter" = $3,
              "sigmaAfter" = $4,
              "displayAfter" = $5,
              "won" = $6,
              "updatedAt" = now()
            where "id" = $1 and "matchId" = $2
          `,
          [
            player.id,
            matchId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "right",
          ],
        );

        await client.query(
          `
            update "PickupPlayerSeasonRating"
            set
              "mu" = $3,
              "sigma" = $4,
              "displayRating" = $5,
              "gamesPlayed" = "gamesPlayed" + 1,
              "wins" = "wins" + $6,
              "losses" = "losses" + $7,
              "updatedAt" = now()
            where "seasonId" = $1 and "playerId" = $2
          `,
          [
            match.seasonId,
            player.playerId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "right" ? 1 : 0,
            winnerTeam === "right" ? 0 : 1,
          ],
        );
      }

      await client.query(
        `
          update "PickupMatch"
          set
            "status" = 'completed',
            "winnerTeam" = $2::"PickupTeamSide",
            "finalScore" = $3,
            "resultPayload" = $4::jsonb,
            "completedAt" = now(),
            "updatedAt" = now()
          where "id" = $1
        `,
        [
          matchId,
          winnerTeam,
          typeof payload.finalScore === "string" ? payload.finalScore : null,
          JSON.stringify(payload),
        ],
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    await broadcastPublicState();
  }

  async function emitSocketState(socket: Socket, session: PickupSessionIdentity | null) {
    socket.emit("pickup:public-state", await getPublicState());
    if (session) {
      socket.emit("pickup:state", await getPlayerState(session.player));
    }
  }

  async function hydrateTimers() {
    const matches = await pool.query<PickupMatchRow>(
      `
        select
          "id",
          "queueId",
          "seasonId",
          "status",
          "readyDeadlineAt",
          "vetoDeadlineAt",
          "currentCaptainPlayerId",
          "finalMapKey",
          "bannedMapKeys",
          "vetoState",
          "balanceSummary",
          "provisionPayload",
          "resultPayload",
          "serverIp",
          "serverPort",
          "serverJoinAddress",
          "serverLocationCountryCode",
          "serverLocationCountryName",
          "serverProvisionedAt",
          "liveStartedAt",
          "completedAt",
          "winnerTeam",
          "finalScore",
          "createdAt"
        from "PickupMatch"
        where "status" in ('ready_check', 'veto')
      `,
    );

    for (const match of matches.rows) {
      if (match.status === "ready_check") {
        scheduleReadyTimer(match.id, match.readyDeadlineAt);
      } else if (match.status === "veto") {
        scheduleVetoTimer(match.id, match.vetoDeadlineAt);
      }
    }
  }

  async function getPlayerStateByToken(token: string) {
    const session = await authenticatePickupSession(token);
    if (!session) {
      return null;
    }

    return getPlayerState(session.player);
  }

  async function verifyCallbackSignature(
    matchId: string,
    request: RawBodyRequest,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match) {
      throw new Error("Pickup match was not found.");
    }

    const queue = await getDefaultQueue();
    if (!queue?.callbackSecret) {
      throw new Error("Pickup callback secret is not configured.");
    }

    const signature = request.header("x-pickup-signature")?.trim();
    const rawBody = request.rawBody ?? JSON.stringify(request.body ?? {});
    if (!signature) {
      throw new Error("Missing pickup callback signature.");
    }

    const expected = createSignature(queue.callbackSecret, rawBody);
    if (signature !== expected) {
      throw new Error("Invalid pickup callback signature.");
    }

    return match;
  }

  return {
    async getPublicState() {
      return getPublicState();
    },
    async getPlayerStateByToken(token: string) {
      return getPlayerStateByToken(token);
    },
    async hydrate() {
      await ensureBootstrapData();
      await hydrateTimers();
      await broadcastPublicState();
    },
    async authenticateSocket(socket: Socket) {
      const rawToken =
        typeof socket.handshake.auth?.pickupToken === "string"
          ? socket.handshake.auth.pickupToken.trim()
          : "";
      if (!rawToken) {
        return null;
      }

      return authenticatePickupSession(rawToken);
    },
    async handleSocketConnection(socket: Socket, session: PickupSessionIdentity | null) {
      socket.join("pickup:public");
      if (session) {
        socket.join(`pickup:player:${session.player.id}`);
      }

      await emitSocketState(socket, session);

      socket.on("pickup:queue:join", async () => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        try {
          socket.emit("pickup:state", await joinQueue(session));
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      socket.on("pickup:queue:leave", async () => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        try {
          socket.emit("pickup:state", await leaveQueue(session));
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      socket.on("pickup:lobby:ready", async () => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        try {
          socket.emit("pickup:state", await markReady(session));
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      socket.on("pickup:veto:ban", async (payload: unknown) => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        const mapKey =
          typeof (payload as { mapKey?: unknown })?.mapKey === "string"
            ? (payload as { mapKey: string }).mapKey.trim()
            : "";
        if (!mapKey) {
          socket.emit("pickup:error", { message: "A map key is required." });
          return;
        }

        try {
          socket.emit("pickup:state", await banMap(session, mapKey));
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    async handleProvisionCallback(request: RawBodyRequest, response: express.Response) {
      try {
        const matchId =
          typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
        if (!matchId) {
          response.status(400).json({ ok: false, error: "matchId is required." });
          return;
        }

        await verifyCallbackSignature(matchId, request);
        await applyProvisionResult(matchId, request.body as Record<string, unknown>);
        response.json({ ok: true });
      } catch (error) {
        response.status(400).json({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    async handleResultCallback(request: RawBodyRequest, response: express.Response) {
      try {
        const matchId =
          typeof request.body?.matchId === "string" ? request.body.matchId.trim() : "";
        if (!matchId) {
          response.status(400).json({ ok: false, error: "matchId is required." });
          return;
        }

        await verifyCallbackSignature(matchId, request);
        await applyMatchResult(matchId, request.body as Record<string, unknown>);
        response.json({ ok: true });
      } catch (error) {
        response.status(400).json({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
