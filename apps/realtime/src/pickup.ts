import crypto from "node:crypto";
import {
  type PickupDiscordWebhookPayload,
  type PickupMatchReportPayload,
  pickupQueueAlertsSignatureHeader,
} from "@qltracker/contracts";
import { createSignature } from "@qltracker/crypto";
import { stripQuakeColors } from "@qltracker/quake";
import type express from "express";
import type { PoolClient } from "pg";
import type { Server, Socket } from "socket.io";
import { Rating, TrueSkill } from "ts-trueskill";
import { config } from "./config.js";
import { pool } from "./db.js";
import { lookupCountry } from "./geolite.js";
import { createPickupCallbackApi } from "./pickup/callbacks.js";
import { applyPickupMatchStats } from "./pickup/match-stats.js";
import { defaultDisplayRating } from "./pickup/ratings.js";
import { shouldApplyPickupRating } from "./pickup/rating-guard.js";
import { chooseBalancedTeams } from "./pickup/matchmaking.js";
import { createPlayerStateApi } from "./pickup/player-state.js";
import { parseJson, queueToPublicState } from "./pickup/state.js";
import type {
  PickupActiveRatingRow,
  PickupBalanceSummary,
  PickupMatchPlayerRow,
  PickupMatchSubRequestRow,
  PickupMatchRow,
  PickupPlayerIdentity,
  PickupPlayerLockRow,
  PickupQueueMemberRow,
  PickupQueueRow,
  PickupPublicState,
  PickupRatingRow,
  PickupSeasonRow,
  PickupSessionIdentity,
  PickupSettingsRow,
  PickupVetoState,
  RawBodyRequest,
} from "./pickup/types.js";

const DEFAULT_QUEUE = {
  description: "Seasonal 4v4 Clan Arena pickup queue.",
  name: "4v4 CA",
  playerCount: 8,
  slug: "4v4-ca",
  teamSize: 4,
};

const DEFAULT_SETTINGS = {
  callbackSecret: null,
  id: "default",
  provisionApiUrl: null,
  provisionAuthToken: null,
  readyCheckDurationSeconds: 60,
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
const COMPLETED_MATCH_VISIBLE_MS = 12_000;
const PROVISION_RETRY_DELAYS_MS = [0, 5_000, 10_000, 20_000, 30_000] as const;
const SUBSTITUTE_REQUEST_EXPIRY_MS = 90_000;
const ABORTABLE_PICKUP_STATUSES = [
  "ready_check",
  "veto",
  "provisioning",
  "server_ready",
  "live",
] as const;
const ABORTABLE_PICKUP_STATUS_SET = new Set<string>(ABORTABLE_PICKUP_STATUSES);
function hashPickupToken(token: string) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`pickup:${token}`)
    .digest("hex");
}

function createRating(mu: number, sigma: number) {
  return ratingEnv.createRating(mu, sigma);
}

const QUEUE_MEMBER_CLEANUP_MIN_INTERVAL_MS = 60_000;
const QUEUE_MEMBER_CLEANUP_MAX_INTERVAL_MS = 5 * 60_000;
const QUEUE_RESTART_CLEANUP_MIN_DELAY_MS = 30_000;

export function createPickupService(io: Server) {
  const serviceStartedAt = new Date();
  const readyTimers = new Map<string, NodeJS.Timeout>();
  const vetoTimers = new Map<string, NodeJS.Timeout>();
  const subRequestTimers = new Map<string, NodeJS.Timeout>();
  const queueDisconnectTimers = new Map<string, NodeJS.Timeout>();
  const connectedPickupSocketsByPlayerId = new Map<string, Set<string>>();
  let queueMemberCleanupInterval: NodeJS.Timeout | null = null;
  let restartQueueCleanupTimer: NodeJS.Timeout | null = null;

  async function notifyDiscordWebhook(
    payload: PickupDiscordWebhookPayload,
  ): Promise<void> {
    if (
      !config.pickupQueueAlertsWebhookUrl ||
      !config.pickupQueueAlertsWebhookSecret
    ) {
      return;
    }

    const body = JSON.stringify(payload);
    const signature = createSignature(
      config.pickupQueueAlertsWebhookSecret,
      body,
    );

    try {
      const response = await fetch(config.pickupQueueAlertsWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [pickupQueueAlertsSignatureHeader]: signature,
        },
        body,
      });

      if (!response.ok) {
        console.warn(
          `Failed to deliver pickup queue alert webhook: HTTP ${response.status}`,
        );
      }
    } catch (error) {
      console.warn("Failed to deliver pickup queue alert webhook", error);
    }
  }

  async function notifyMatchCompleted(
    match: PickupMatchRow,
    players: readonly PickupMatchPlayerRow[],
  ): Promise<void> {
    const queue = await getQueueById(match.queueId);
    if (!queue || !match.completedAt || !match.winnerTeam) {
      return;
    }

    const toPayloadPlayer = (player: PickupMatchPlayerRow) => ({
      avatarUrl: player.avatarUrl,
      displayAfter: player.displayAfter,
      displayBefore: player.displayBefore,
      id: player.id,
      personaName: stripQuakeColors(player.personaName).trim(),
      profileUrl: player.profileUrl,
      steamId: player.steamId,
      won: player.won,
    });

    const payload: PickupMatchReportPayload = {
      completedAt: match.completedAt.toISOString(),
      finalMapKey: match.finalMapKey,
      finalScore: match.finalScore,
      matchId: match.id,
      queue: {
        id: queue.id,
        name: queue.name,
        playerCount: queue.playerCount,
        slug: queue.slug,
        teamSize: queue.teamSize,
      },
      teams: {
        left: players
          .filter((player) => player.team === "left")
          .map(toPayloadPlayer),
        right: players
          .filter((player) => player.team === "right")
          .map(toPayloadPlayer),
      },
      type: "pickup.match_report",
      winnerTeam: match.winnerTeam,
    };

    await notifyDiscordWebhook(payload);
  }

  async function ensureBootstrapData() {
    await pool.query(
      `
        insert into "PickupSettings" (
          "id",
          "readyCheckDurationSeconds",
          "vetoTurnDurationSeconds",
          "provisionApiUrl",
          "provisionAuthToken",
          "callbackSecret",
          "createdAt",
          "updatedAt"
        )
        values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          now(),
          now()
        )
        on conflict ("id") do nothing
      `,
      [
        DEFAULT_SETTINGS.id,
        DEFAULT_SETTINGS.readyCheckDurationSeconds,
        DEFAULT_SETTINGS.vetoTurnDurationSeconds,
        DEFAULT_SETTINGS.provisionApiUrl,
        DEFAULT_SETTINGS.provisionAuthToken,
        DEFAULT_SETTINGS.callbackSecret,
      ],
    );

    const insertedQueueResult = await pool.query<PickupQueueRow>(
      `
        insert into "PickupQueue" (
          "id",
          "slug",
          "name",
          "description",
          "teamSize",
          "playerCount",
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
          true,
          now(),
          now()
        )
        on conflict ("slug") do nothing
        returning
          "id",
          "slug",
          "name",
          "description",
          "teamSize",
          "playerCount",
          "enabled"
      `,
      [
        DEFAULT_QUEUE.slug,
        DEFAULT_QUEUE.name,
        DEFAULT_QUEUE.description,
        DEFAULT_QUEUE.teamSize,
        DEFAULT_QUEUE.playerCount,
      ],
    );

    const insertedQueue = insertedQueueResult.rows[0] ?? null;
    const queue =
      insertedQueue ??
      (
        await pool.query<PickupQueueRow>(
          `
            select
              "id",
              "slug",
              "name",
              "description",
              "teamSize",
              "playerCount",
              "enabled"
            from "PickupQueue"
            where "slug" = $1
            limit 1
          `,
          [DEFAULT_QUEUE.slug],
        )
      ).rows[0]!;

    if (insertedQueue) {
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
            "startingRating",
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
            1000,
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

  async function getPickupSettings() {
    await ensureBootstrapData();
    const result = await pool.query<PickupSettingsRow>(
      `
        select
          "id",
          "readyCheckDurationSeconds",
          "vetoTurnDurationSeconds",
          "provisionApiUrl",
          "provisionAuthToken",
          "callbackSecret"
        from "PickupSettings"
        where "id" = $1
        limit 1
      `,
      [DEFAULT_SETTINGS.id],
    );

    const settings = result.rows[0];
    if (!settings) {
      throw new Error("Pickup settings are unavailable.");
    }

    return settings;
  }

  async function getAllQueues() {
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
          "enabled"
        from "PickupQueue"
      `,
    );

    return result.rows.sort((left, right) => {
      if (
        left.slug === DEFAULT_QUEUE.slug &&
        right.slug !== DEFAULT_QUEUE.slug
      ) {
        return -1;
      }

      if (
        right.slug === DEFAULT_QUEUE.slug &&
        left.slug !== DEFAULT_QUEUE.slug
      ) {
        return 1;
      }

      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  async function getQueueById(queueId: string) {
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
          "enabled"
        from "PickupQueue"
        where "id" = $1
        limit 1
      `,
      [queueId],
    );

    return result.rows[0] ?? null;
  }

  async function getQueueBySlug(queueSlug: string) {
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
          "enabled"
        from "PickupQueue"
        where "slug" = $1
        limit 1
      `,
      [queueSlug],
    );

    return result.rows[0] ?? null;
  }

  async function getPrimaryQueue() {
    const queues = await getAllQueues();
    return (
      queues.find((queue) => queue.slug === DEFAULT_QUEUE.slug) ??
      queues.find((queue) => queue.enabled) ??
      queues[0] ??
      null
    );
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
          "startingRating",
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

  async function getActivePlayerLock(playerId: string) {
    const result = await pool.query<PickupPlayerLockRow>(
      `
        select
          "id",
          "reason",
          "expiresAt"
        from "PickupPlayerLock"
        where
          "playerId" = $1
          and "revokedAt" is null
          and ("expiresAt" is null or "expiresAt" > now())
        order by "createdAt" desc
        limit 1
      `,
      [playerId],
    );

    return result.rows[0] ?? null;
  }

  function formatLockMessage(lock: PickupPlayerLockRow) {
    const until = lock.expiresAt
      ? ` until ${lock.expiresAt.toISOString()}`
      : " permanently";
    const reason = lock.reason?.trim() ? ` Reason: ${lock.reason.trim()}` : "";

    return `This account is locked from matchmaking${until}.${reason}`;
  }

  async function authenticatePickupSession(token: string) {
    const result = await pool.query<
      PickupSessionIdentity & {
        avatarUrl: string | null;
        countryCode: string | null;
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
          coalesce(p."customAvatarUrl", p."avatarUrl") as "avatarUrl",
          p."countryCode" as "countryCode",
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
        countryCode: row.countryCode,
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
          qm."id" as "queueMemberId",
          qm."playerId",
          qm."joinedAt",
          p."id" as "id",
          p."personaName",
          coalesce(p."customAvatarUrl", p."avatarUrl") as "avatarUrl",
          p."countryCode",
          p."profileUrl",
          p."steamId"
        from "PickupQueueMember" qm
        inner join "PickupPlayer" p on p."id" = qm."playerId"
        where
          qm."queueId" = $1
          and not exists (
            select 1
            from "PickupPlayerLock" pl
            where
              pl."playerId" = qm."playerId"
              and pl."revokedAt" is null
              and (pl."expiresAt" is null or pl."expiresAt" > now())
          )
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
    const startingRating = season.startingRating;
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
      const rating = existing.rows[0];
      if (
        rating.gamesPlayed === 0 &&
        (rating.displayRating !== startingRating ||
          rating.mu !== startingRating ||
          rating.sigma !== ratingEnv.sigma)
      ) {
        const normalized = await pool.query<PickupRatingRow>(
          `
            update "PickupPlayerSeasonRating"
            set
              "mu" = $3,
              "sigma" = $4,
              "displayRating" = $5,
              "seededFrom" = 'season-starting-rating',
              "updatedAt" = now()
            where "seasonId" = $1 and "playerId" = $2
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
            startingRating,
            ratingEnv.sigma,
            startingRating,
          ],
        );

        return normalized.rows[0] ?? rating;
      }

      return rating;
    }

    const mu = startingRating;
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
        startingRating,
        "season-starting-rating",
      ],
    );

    return insert.rows[0]!;
  }

  async function getPlayerSeasonRating(playerId: string, seasonId: string) {
    const result = await pool.query<PickupRatingRow>(
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
      [seasonId, playerId],
    );

    return result.rows[0] ?? null;
  }

  async function getPreferredPlayerRating(playerId: string) {
    const result = await pool.query<PickupRatingRow>(
      `
        select
          r."playerId",
          r."mu",
          r."sigma",
          r."displayRating",
          r."gamesPlayed",
          r."wins",
          r."losses",
          rank."id" as "rankId",
          rank."title" as "rankTitle",
          rank."badgeUrl" as "rankBadgeUrl",
          rank."minRating" as "rankMinRating"
        from "PickupPlayerSeasonRating" r
        inner join "PickupSeason" s
          on s."id" = r."seasonId"
        inner join "PickupQueue" q
          on q."id" = s."queueId"
        left join lateral (
          select
            pr."id",
            pr."title",
            pr."badgeUrl",
            pr."minRating"
          from "PickupRank" pr
          where pr."queueId" = q."id"
            and pr."active" = true
            and pr."minRating" <= r."displayRating"
          order by pr."minRating" desc, pr."sortOrder" asc, pr."createdAt" asc
          limit 1
        ) rank on true
        where r."playerId" = $1
          and s."status" = 'active'
        order by r."updatedAt" desc, s."startsAt" desc
        limit 1
      `,
      [playerId],
    );

    return result.rows[0] ?? null;
  }

  async function getPlayerActiveRatings(playerId: string) {
    const result = await pool.query<PickupActiveRatingRow>(
      `
        select
          r."playerId",
          r."mu",
          r."sigma",
          r."displayRating",
          r."gamesPlayed",
          r."wins",
          r."losses",
          s."id" as "seasonId",
          s."name" as "seasonName",
          q."id" as "queueId",
          q."slug" as "queueSlug",
          q."name" as "queueName",
          rank."id" as "rankId",
          rank."title" as "rankTitle",
          rank."badgeUrl" as "rankBadgeUrl",
          rank."minRating" as "rankMinRating"
        from "PickupPlayerSeasonRating" r
        inner join "PickupSeason" s
          on s."id" = r."seasonId"
        inner join "PickupQueue" q
          on q."id" = s."queueId"
        left join lateral (
          select
            pr."id",
            pr."title",
            pr."badgeUrl",
            pr."minRating"
          from "PickupRank" pr
          where pr."queueId" = q."id"
            and pr."active" = true
            and pr."minRating" <= r."displayRating"
          order by pr."minRating" desc, pr."sortOrder" asc, pr."createdAt" asc
          limit 1
        ) rank on true
        where r."playerId" = $1
          and s."status" = 'active'
        order by r."displayRating" desc, r."updatedAt" desc, s."startsAt" desc
      `,
      [playerId],
    );

    return result.rows;
  }

  async function getQueueMembership(playerId: string) {
    const result = await pool.query<
      PickupQueueRow & {
        joinedAt: Date;
      }
    >(
      `
        select
          qm."joinedAt",
          q."id",
          q."slug",
          q."name",
          q."description",
          q."teamSize",
          q."playerCount",
          q."enabled"
        from "PickupQueueMember" qm
        inner join "PickupQueue" q on q."id" = qm."queueId"
        where
          qm."playerId" = $1
          and not exists (
            select 1
            from "PickupPlayerLock" pl
            where
              pl."playerId" = qm."playerId"
              and pl."revokedAt" is null
              and (pl."expiresAt" is null or pl."expiresAt" > now())
          )
        limit 1
      `,
      [playerId],
    );

    return result.rows[0] ?? null;
  }

  async function getPublicState(): Promise<PickupPublicState> {
    const queues = await getAllQueues();
    if (!queues.length) {
      throw new Error("Pickup queue is unavailable.");
    }

    const [settings, queueCounts, seasons, queueMembers] = await Promise.all([
      getPickupSettings(),
      pool.query<{ count: string; queueId: string }>(
        `
          select qm."queueId", count(*)::text as count
          from "PickupQueueMember" qm
          where not exists (
            select 1
            from "PickupPlayerLock" pl
            where
              pl."playerId" = qm."playerId"
              and pl."revokedAt" is null
              and (pl."expiresAt" is null or pl."expiresAt" > now())
          )
          group by qm."queueId"
        `,
      ),
      Promise.all(queues.map((queue) => getActiveSeason(queue.id))),
      Promise.all(
        queues.map((queue) => getQueueMembers(queue.id, queue.playerCount)),
      ),
    ]);
    const countByQueueId = new Map(
      queueCounts.rows.map((row) => [row.queueId, Number(row.count ?? "0")]),
    );
    const queuesState = queues.map((queue, index) =>
      queueToPublicState(
        queue,
        settings,
        countByQueueId.get(queue.id) ?? 0,
        seasons[index] ?? null,
        queueMembers[index] ?? [],
      ),
    );
    const primaryQueue = queuesState[0] ?? null;

    return {
      queue: primaryQueue,
      queues: queuesState,
      season: primaryQueue?.season ?? null,
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
      provisionPayload: parseJson<Record<string, unknown>>(
        row.provisionPayload,
      ),
      resultPayload: parseJson<Record<string, unknown>>(row.resultPayload),
      vetoState: parseJson<PickupVetoState>(row.vetoState),
    };
  }

  async function getLatestPlayerActiveMatch(playerId: string) {
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
          and (
            m."status" in ('provisioning', 'server_ready', 'live')
            or (m."status" = 'ready_check' and m."readyDeadlineAt" > now())
            or m."status" = 'veto'
          )
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
      provisionPayload: parseJson<Record<string, unknown>>(
        row.provisionPayload,
      ),
      resultPayload: parseJson<Record<string, unknown>>(row.resultPayload),
      vetoState: parseJson<PickupVetoState>(row.vetoState),
    };
  }

  async function getLatestPlayerRecentCompletedMatch(playerId: string) {
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
          and m."status" = 'completed'
          and m."completedAt" >= $2
        order by m."createdAt" desc
        limit 1
      `,
      [playerId, new Date(Date.now() - COMPLETED_MATCH_VISIBLE_MS)],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      ...row,
      balanceSummary: parseJson<PickupBalanceSummary>(row.balanceSummary),
      provisionPayload: parseJson<Record<string, unknown>>(
        row.provisionPayload,
      ),
      resultPayload: parseJson<Record<string, unknown>>(row.resultPayload),
      vetoState: parseJson<PickupVetoState>(row.vetoState),
    };
  }

  async function getMatchPlayers(matchId: string) {
    const result = await pool.query<PickupMatchPlayerRow>(
      `
        select
          mp."id" as "matchPlayerId",
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
          p."id" as "id",
          p."personaName",
          coalesce(p."customAvatarUrl", p."avatarUrl") as "avatarUrl",
          p."countryCode",
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

  async function getPickupPlayerIdentityById(playerId: string) {
    const result = await pool.query<PickupPlayerIdentity>(
      `
        select
          "id",
          "steamId",
          "personaName",
          coalesce("customAvatarUrl", "avatarUrl") as "avatarUrl",
          "countryCode",
          "profileUrl"
        from "PickupPlayer"
        where "id" = $1
        limit 1
      `,
      [playerId],
    );

    return result.rows[0] ?? null;
  }

  async function getPendingSubRequestForPlayer(
    playerId: string,
    role: "requester" | "target",
  ) {
    const playerColumn =
      role === "requester" ? `sr."requesterPlayerId"` : `sr."targetPlayerId"`;
    const result = await pool.query<PickupMatchSubRequestRow>(
      `
        select
          sr."id",
          sr."matchId",
          sr."status",
          sr."expiresAt",
          sr."respondedAt",
          sr."createdAt",
          m."status" as "stage",
          m."queueId",
          q."name" as "queueName",
          q."slug" as "queueSlug",
          m."finalMapKey",
          requester."id" as "requesterPlayerId",
          requester."personaName" as "requesterPersonaName",
          coalesce(requester."customAvatarUrl", requester."avatarUrl") as "requesterAvatarUrl",
          requester."countryCode" as "requesterCountryCode",
          requester."profileUrl" as "requesterProfileUrl",
          requester."steamId" as "requesterSteamId",
          target."id" as "targetPlayerId",
          target."personaName" as "targetPersonaName",
          coalesce(target."customAvatarUrl", target."avatarUrl") as "targetAvatarUrl",
          target."countryCode" as "targetCountryCode",
          target."profileUrl" as "targetProfileUrl",
          target."steamId" as "targetSteamId"
        from "PickupMatchSubRequest" sr
        inner join "PickupMatch" m on m."id" = sr."matchId"
        inner join "PickupQueue" q on q."id" = m."queueId"
        inner join "PickupPlayer" requester on requester."id" = sr."requesterPlayerId"
        inner join "PickupPlayer" target on target."id" = sr."targetPlayerId"
        where
          ${playerColumn} = $1
          and sr."status" = 'pending'
          and sr."expiresAt" > now()
          and m."status" in ('veto', 'server_ready')
        order by sr."createdAt" desc
        limit 1
      `,
      [playerId],
    );

    return result.rows[0] ?? null;
  }

  async function getPendingSubRequestForRequester(playerId: string) {
    return getPendingSubRequestForPlayer(playerId, "requester");
  }

  async function getPendingSubRequestForTarget(playerId: string) {
    return getPendingSubRequestForPlayer(playerId, "target");
  }

  async function getPendingMatchSubRequest(matchId: string) {
    const result = await pool.query<PickupMatchSubRequestRow>(
      `
        select
          sr."id",
          sr."matchId",
          sr."status",
          sr."expiresAt",
          sr."respondedAt",
          sr."createdAt",
          m."status" as "stage",
          m."queueId",
          q."name" as "queueName",
          q."slug" as "queueSlug",
          m."finalMapKey",
          requester."id" as "requesterPlayerId",
          requester."personaName" as "requesterPersonaName",
          coalesce(requester."customAvatarUrl", requester."avatarUrl") as "requesterAvatarUrl",
          requester."countryCode" as "requesterCountryCode",
          requester."profileUrl" as "requesterProfileUrl",
          requester."steamId" as "requesterSteamId",
          target."id" as "targetPlayerId",
          target."personaName" as "targetPersonaName",
          coalesce(target."customAvatarUrl", target."avatarUrl") as "targetAvatarUrl",
          target."countryCode" as "targetCountryCode",
          target."profileUrl" as "targetProfileUrl",
          target."steamId" as "targetSteamId"
        from "PickupMatchSubRequest" sr
        inner join "PickupMatch" m on m."id" = sr."matchId"
        inner join "PickupQueue" q on q."id" = m."queueId"
        inner join "PickupPlayer" requester on requester."id" = sr."requesterPlayerId"
        inner join "PickupPlayer" target on target."id" = sr."targetPlayerId"
        where
          sr."matchId" = $1
          and sr."status" = 'pending'
          and sr."expiresAt" > now()
        order by sr."createdAt" desc
        limit 1
      `,
      [matchId],
    );

    return result.rows[0] ?? null;
  }

  const playerStateApi = createPlayerStateApi({
    getActivePlayerLock,
    getActiveSeason,
    getLatestPlayerActiveMatch,
    getLatestPlayerRecentCompletedMatch,
    getPendingMatchSubRequest,
    getPendingSubRequestForRequester,
    getPendingSubRequestForTarget,
    getMatchPlayers,
    getOrCreatePlayerSeasonRating,
    getPlayerActiveRatings,
    getPlayerSeasonRating,
    getPreferredPlayerRating,
    getPrimaryQueue,
    getPublicState,
    getQueueMembership,
  });
  const { getPlayerState } = playerStateApi;

  async function emitPlayerState(playerId: string) {
    const identityResult = await pool.query<PickupPlayerIdentity>(
      `
        select
          "id",
          "steamId",
          "personaName",
          coalesce("customAvatarUrl", "avatarUrl") as "avatarUrl",
          "countryCode",
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
      io.to(`pickup:player:${playerId}`).emit(
        "pickup:queue:update",
        state.queue,
      );
    } else if (state.stage === "ready_check" || state.stage === "veto") {
      io.to(`pickup:player:${playerId}`).emit(
        "pickup:lobby:update",
        state.match,
      );
    } else if (state.stage !== "idle") {
      io.to(`pickup:player:${playerId}`).emit(
        "pickup:match:update",
        state.match,
      );
    }
  }

  async function broadcastPublicState() {
    const publicState = await getPublicState();
    io.emit("pickup:public-state", publicState);
    io.emit("pickup:queues:update", publicState.queues);
    io.emit("pickup:queue:update", publicState.queue);
  }

  function emitMatchDetailUpdate(
    matchId: string,
    reason: "chat" | "live" | "result" | "stats",
  ) {
    io.emit("pickup:match-detail:update", {
      matchId,
      reason,
      updatedAt: new Date().toISOString(),
    });
  }

  async function emitStatesForPlayerIds(playerIds: readonly string[]) {
    const uniquePlayerIds = [...new Set(playerIds.filter(Boolean))];
    for (const playerId of uniquePlayerIds) {
      await emitPlayerState(playerId);
    }
  }

  function emitPickupErrorToPlayers(
    playerIds: readonly string[],
    message: string,
  ) {
    const uniquePlayerIds = [...new Set(playerIds.filter(Boolean))];
    for (const playerId of uniquePlayerIds) {
      io.to(`pickup:player:${playerId}`).emit("pickup:error", { message });
    }
  }

  async function emitSubRequestPlayerStates(
    matchId: string,
    requesterPlayerId: string,
    targetPlayerId: string,
  ) {
    const matchPlayers = await getMatchPlayers(matchId);
    await emitStatesForPlayerIds([
      ...matchPlayers.map((player) => player.playerId),
      requesterPlayerId,
      targetPlayerId,
    ]);
  }

  async function getPendingSubRequestById(requestId: string) {
    const result = await pool.query<PickupMatchSubRequestRow>(
      `
        select
          sr."id",
          sr."matchId",
          sr."status",
          sr."expiresAt",
          sr."respondedAt",
          sr."createdAt",
          m."status" as "stage",
          m."queueId",
          q."name" as "queueName",
          q."slug" as "queueSlug",
          m."finalMapKey",
          requester."id" as "requesterPlayerId",
          requester."personaName" as "requesterPersonaName",
          coalesce(requester."customAvatarUrl", requester."avatarUrl") as "requesterAvatarUrl",
          requester."countryCode" as "requesterCountryCode",
          requester."profileUrl" as "requesterProfileUrl",
          requester."steamId" as "requesterSteamId",
          target."id" as "targetPlayerId",
          target."personaName" as "targetPersonaName",
          coalesce(target."customAvatarUrl", target."avatarUrl") as "targetAvatarUrl",
          target."countryCode" as "targetCountryCode",
          target."profileUrl" as "targetProfileUrl",
          target."steamId" as "targetSteamId"
        from "PickupMatchSubRequest" sr
        inner join "PickupMatch" m on m."id" = sr."matchId"
        inner join "PickupQueue" q on q."id" = m."queueId"
        inner join "PickupPlayer" requester on requester."id" = sr."requesterPlayerId"
        inner join "PickupPlayer" target on target."id" = sr."targetPlayerId"
        where
          sr."id" = $1
          and sr."status" = 'pending'
        limit 1
      `,
      [requestId],
    );

    return result.rows[0] ?? null;
  }

  function clearQueueDisconnectTimer(playerId: string) {
    const timer = queueDisconnectTimers.get(playerId);
    if (!timer) {
      return;
    }

    clearTimeout(timer);
    queueDisconnectTimers.delete(playerId);
  }

  function trackConnectedPickupSocket(playerId: string, socketId: string) {
    clearQueueDisconnectTimer(playerId);
    const sockets =
      connectedPickupSocketsByPlayerId.get(playerId) ?? new Set<string>();
    sockets.add(socketId);
    connectedPickupSocketsByPlayerId.set(playerId, sockets);
  }

  function untrackConnectedPickupSocket(playerId: string, socketId: string) {
    const sockets = connectedPickupSocketsByPlayerId.get(playerId);
    if (!sockets) {
      return 0;
    }

    sockets.delete(socketId);
    if (sockets.size > 0) {
      return sockets.size;
    }

    connectedPickupSocketsByPlayerId.delete(playerId);
    return 0;
  }

  function connectedPickupPlayerIds() {
    return [...connectedPickupSocketsByPlayerId.keys()];
  }

  async function emitQueueCleanupResult(
    reason: string,
    rows: readonly { playerId: string; queueId: string }[],
  ) {
    if (rows.length === 0) {
      return;
    }

    console.log(`pickup cleaned ${rows.length} queue member(s): ${reason}`);
    await broadcastPublicState();

    const playerIds = [...new Set(rows.map((row) => row.playerId))];
    for (const playerId of playerIds) {
      await emitPlayerState(playerId);
    }
  }

  async function cleanupExpiredQueueMembers(reason: string) {
    const cutoff = new Date(Date.now() - config.pickupQueueMemberMaxAgeMs);
    const result = await pool.query<{ playerId: string; queueId: string }>(
      `
        delete from "PickupQueueMember" qm
        where
          qm."joinedAt" < $1
          and not exists (
            select 1
            from "PickupMatchPlayer" mp
            inner join "PickupMatch" m on m."id" = mp."matchId"
            where
              mp."playerId" = qm."playerId"
              and (
                m."status" in ('provisioning', 'server_ready', 'live')
                or (m."status" = 'ready_check' and m."readyDeadlineAt" > now())
                or (m."status" = 'veto' and m."vetoDeadlineAt" > now())
              )
          )
        returning "playerId", "queueId"
      `,
      [cutoff],
    );

    await emitQueueCleanupResult(reason, result.rows);
  }

  async function cleanupLockedQueueMembers(reason: string) {
    const result = await pool.query<{ playerId: string; queueId: string }>(
      `
        delete from "PickupQueueMember" qm
        where exists (
          select 1
          from "PickupPlayerLock" pl
          where
            pl."playerId" = qm."playerId"
            and pl."revokedAt" is null
            and (pl."expiresAt" is null or pl."expiresAt" > now())
        )
        returning "playerId", "queueId"
      `,
    );

    await emitQueueCleanupResult(reason, result.rows);
  }

  async function cleanupDisconnectedPreexistingQueueMembers() {
    const result = await pool.query<{ playerId: string; queueId: string }>(
      `
        delete from "PickupQueueMember" qm
        where
          qm."joinedAt" < $1
          and not (qm."playerId" = any($2::text[]))
          and not exists (
            select 1
            from "PickupMatchPlayer" mp
            inner join "PickupMatch" m on m."id" = mp."matchId"
            where
              mp."playerId" = qm."playerId"
              and (
                m."status" in ('provisioning', 'server_ready', 'live')
                or (m."status" = 'ready_check' and m."readyDeadlineAt" > now())
                or (m."status" = 'veto' and m."vetoDeadlineAt" > now())
              )
          )
        returning "playerId", "queueId"
      `,
      [serviceStartedAt, connectedPickupPlayerIds()],
    );

    await emitQueueCleanupResult("restart-disconnected", result.rows);
  }

  function startQueueMemberCleanupLoop() {
    if (queueMemberCleanupInterval) {
      return;
    }

    const intervalMs = Math.min(
      QUEUE_MEMBER_CLEANUP_MAX_INTERVAL_MS,
      Math.max(
        QUEUE_MEMBER_CLEANUP_MIN_INTERVAL_MS,
        Math.floor(config.pickupQueueMemberMaxAgeMs / 4),
      ),
    );
    queueMemberCleanupInterval = setInterval(() => {
      void cleanupPendingSubRequests("interval").catch((error) => {
        console.error("Failed to clean pending substitute requests:", error);
      });
      void cleanupLockedQueueMembers("locked").catch((error) => {
        console.error("Failed to clean locked pickup queue members:", error);
      });
      void cleanupExpiredQueueMembers("max-age").catch((error) => {
        console.error("Failed to clean expired pickup queue members:", error);
      });
    }, intervalMs);
    queueMemberCleanupInterval.unref?.();
  }

  function scheduleRestartQueueCleanup() {
    if (restartQueueCleanupTimer) {
      return;
    }

    const delayMs = Math.max(
      QUEUE_RESTART_CLEANUP_MIN_DELAY_MS,
      config.pickupQueueDisconnectGraceMs * 2,
    );
    restartQueueCleanupTimer = setTimeout(() => {
      restartQueueCleanupTimer = null;
      void cleanupDisconnectedPreexistingQueueMembers().catch((error) => {
        console.error(
          "Failed to clean disconnected preexisting pickup queue members:",
          error,
        );
      });
    }, delayMs);
    restartQueueCleanupTimer.unref?.();
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

  function clearSubRequestTimer(requestId: string) {
    const timer = subRequestTimers.get(requestId);
    if (timer) {
      clearTimeout(timer);
      subRequestTimers.delete(requestId);
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

  function scheduleSubRequestTimer(requestId: string, expiresAt: Date) {
    clearSubRequestTimer(requestId);
    const delay = Math.max(0, expiresAt.getTime() - Date.now());
    subRequestTimers.set(
      requestId,
      setTimeout(() => {
        subRequestTimers.delete(requestId);
        void expireSubRequest(requestId);
      }, delay),
    );
  }

  async function resumeVetoAfterPendingSubRequest(matchId: string) {
    const [match, pendingRequest, settings] = await Promise.all([
      getLatestMatchById(matchId),
      getPendingMatchSubRequest(matchId),
      getPickupSettings(),
    ]);
    if (!match || match.status !== "veto" || !match.vetoState || pendingRequest) {
      return null;
    }

    const vetoDeadlineAt = new Date(
      Date.now() + settings.vetoTurnDurationSeconds * 1000,
    );
    const updateResult = await pool.query(
      `
        update "PickupMatch"
        set
          "vetoDeadlineAt" = $2,
          "updatedAt" = now()
        where
          "id" = $1
          and "status" = 'veto'
          and "vetoState" is not null
        returning "id"
      `,
      [matchId, vetoDeadlineAt],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      return null;
    }

    scheduleVetoTimer(matchId, vetoDeadlineAt);
    return vetoDeadlineAt;
  }

  async function resolvePendingSubRequest(
    requestId: string,
    status: "cancelled" | "declined" | "expired",
    options?: {
      resumeVeto?: boolean;
    },
  ) {
    const request = await getPendingSubRequestById(requestId);
    if (!request) {
      return null;
    }

    clearSubRequestTimer(requestId);

    const updateResult = await pool.query(
      `
        update "PickupMatchSubRequest"
        set
          "status" = $2::"PickupMatchSubRequestStatus",
          "respondedAt" = now(),
          "updatedAt" = now()
        where
          "id" = $1
          and "status" = 'pending'
        returning "id"
      `,
      [requestId, status],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      return null;
    }

    if (request.stage === "veto" && options?.resumeVeto !== false) {
      await resumeVetoAfterPendingSubRequest(request.matchId);
    }

    await emitSubRequestPlayerStates(
      request.matchId,
      request.requesterPlayerId,
      request.targetPlayerId,
    );

    return request;
  }

  async function expireSubRequest(requestId: string) {
    return resolvePendingSubRequest(requestId, "expired");
  }

  async function cancelPendingSubRequestsForMatch(
    matchId: string,
    options?: {
      resumeVeto?: boolean;
    },
  ) {
    const request = await getPendingMatchSubRequest(matchId);
    if (!request) {
      return;
    }

    await resolvePendingSubRequest(request.id, "cancelled", options);
  }

  async function cleanupPendingSubRequests(reason: string) {
    const expiredRequests = await pool.query<{ id: string }>(
      `
        update "PickupMatchSubRequest"
        set
          "status" = 'expired',
          "respondedAt" = now(),
          "updatedAt" = now()
        where
          "status" = 'pending'
          and "expiresAt" <= now()
        returning "id"
      `,
    );

    for (const row of expiredRequests.rows) {
      clearSubRequestTimer(row.id);
    }

    const invalidRequests = await pool.query<{
      id: string;
      matchId: string;
      requesterPlayerId: string;
      targetPlayerId: string;
    }>(
      `
        update "PickupMatchSubRequest" sr
        set
          "status" = 'cancelled',
          "respondedAt" = now(),
          "updatedAt" = now()
        from "PickupMatch" m
        where
          sr."matchId" = m."id"
          and sr."status" = 'pending'
          and (
            m."status" not in ('veto', 'server_ready')
            or exists (
              select 1
              from "PickupPlayerLock" lock
              where
                lock."playerId" in (sr."requesterPlayerId", sr."targetPlayerId")
                and lock."revokedAt" is null
                and (lock."expiresAt" is null or lock."expiresAt" > now())
            )
            or not exists (
              select 1
              from "PickupMatchPlayer" requester_match_player
              where
                requester_match_player."matchId" = sr."matchId"
                and requester_match_player."playerId" = sr."requesterPlayerId"
            )
            or exists (
              select 1
              from "PickupMatchPlayer" target_match_player
              where
                target_match_player."matchId" = sr."matchId"
                and target_match_player."playerId" = sr."targetPlayerId"
            )
            or exists (
              select 1
              from "PickupMatchPlayer" active_match_player
              inner join "PickupMatch" active_match
                on active_match."id" = active_match_player."matchId"
              where
                active_match_player."playerId" = sr."targetPlayerId"
                and active_match_player."matchId" <> sr."matchId"
                and (
                  active_match."status" in ('provisioning', 'server_ready', 'live')
                  or (active_match."status" = 'ready_check' and active_match."readyDeadlineAt" > now())
                  or active_match."status" = 'veto'
                )
            )
          )
        returning
          sr."id",
          sr."matchId",
          sr."requesterPlayerId",
          sr."targetPlayerId"
      `,
    );

    for (const row of invalidRequests.rows) {
      clearSubRequestTimer(row.id);
      if (reason !== "silent") {
        console.log(
          `pickup cancelled invalid substitute request ${row.id}: ${reason}`,
        );
      }
    }

    const matchIdsNeedingVetoResume = [
      ...new Set(invalidRequests.rows.map((row) => row.matchId)),
    ];
    for (const matchId of matchIdsNeedingVetoResume) {
      await resumeVetoAfterPendingSubRequest(matchId);
    }

    const playerIdsToRefresh = [
      ...new Set(
        invalidRequests.rows.flatMap((row) => [
          row.requesterPlayerId,
          row.targetPlayerId,
        ]),
      ),
    ];
    if (playerIdsToRefresh.length > 0) {
      for (const matchId of matchIdsNeedingVetoResume) {
        const players = await getMatchPlayers(matchId);
        playerIdsToRefresh.push(...players.map((player) => player.playerId));
      }
      await emitStatesForPlayerIds(playerIdsToRefresh);
    }
  }

  async function hydratePendingSubRequests() {
    await cleanupPendingSubRequests("startup");

    const requests = await pool.query<{ expiresAt: Date; id: string }>(
      `
        select "id", "expiresAt"
        from "PickupMatchSubRequest"
        where
          "status" = 'pending'
          and "expiresAt" > now()
        order by "createdAt" asc
      `,
    );

    for (const request of requests.rows) {
      scheduleSubRequestTimer(request.id, request.expiresAt);
    }
  }

  async function createMatchFromQueue(
    queue: PickupQueueRow,
    season: PickupSeasonRow,
  ) {
    const settings = await getPickupSettings();
    const members = await getQueueMembers(queue.id, queue.playerCount);
    if (members.length < queue.playerCount) {
      return null;
    }

    const ratedMembers = await Promise.all(
      members.map(async (member) => {
        const rating = await getOrCreatePlayerSeasonRating(
          {
            avatarUrl: member.avatarUrl,
            countryCode: member.countryCode,
            id: member.playerId,
            personaName: member.personaName,
            profileUrl: member.profileUrl,
            steamId: member.steamId,
          },
          season,
        );

        return {
          ...member,
          balanceRating: rating.displayRating,
          balanceRatingSource: "pickup" as const,
          rating,
        };
      }),
    );
    const teams = chooseBalancedTeams(queue.teamSize, ratedMembers);
    const readyDeadlineAt = new Date(
      Date.now() + settings.readyCheckDurationSeconds * 1000,
    );

    const client = await pool.connect();
    try {
      await client.query("begin");
      const lockedMembers = await client.query<PickupQueueMemberRow>(
        `
          select
            qm."id" as "queueMemberId",
            qm."playerId",
            qm."joinedAt",
            p."id" as "id",
            p."personaName",
            coalesce(p."customAvatarUrl", p."avatarUrl") as "avatarUrl",
            p."countryCode",
            p."profileUrl",
            p."steamId"
          from "PickupQueueMember" qm
          inner join "PickupPlayer" p on p."id" = qm."playerId"
          where
            qm."queueId" = $1
            and not exists (
              select 1
              from "PickupPlayerLock" pl
              where
                pl."playerId" = qm."playerId"
                and pl."revokedAt" is null
                and (pl."expiresAt" is null or pl."expiresAt" > now())
            )
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

      const expectedQueueMemberIds = new Set(
        members.map((member) => member.queueMemberId),
      );
      if (
        lockedMembers.rows.some(
          (member) => !expectedQueueMemberIds.has(member.queueMemberId),
        )
      ) {
        await client.query("rollback");
        return null;
      }

      const lockedIds = lockedMembers.rows.map(
        (member) => member.queueMemberId,
      );
      const deletedMembers = await client.query<{ queueMemberId: string }>(
        `
          delete from "PickupQueueMember"
          where "id" = any($1::text[])
          returning "id" as "queueMemberId"
        `,
        [lockedIds],
      );
      if (deletedMembers.rows.length !== lockedIds.length) {
        throw new Error(
          "Pickup queue members could not be claimed atomically.",
        );
      }

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
        [
          queue.id,
          season.id,
          readyDeadlineAt,
          JSON.stringify(teams.balanceSummary),
        ],
      );

      const matchId = matchResult.rows[0]!.id;
      for (const member of ratedMembers) {
        const team = teams.left.some(
          (leftMember) => leftMember.playerId === member.playerId,
        )
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
    const queue = await getQueueById(queueId);
    if (!queue || !queue.enabled) {
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
          select
            gen_random_uuid()::text,
            $1,
            $2,
            $3
          where not exists (
            select 1
            from "PickupPlayerLock" pl
            where
              pl."playerId" = $2
              and pl."revokedAt" is null
              and (pl."expiresAt" is null or pl."expiresAt" > now())
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
    const readyPlayers = players.filter(
      (player) => player.readyState === "ready",
    );
    const pendingPlayers = players.filter(
      (player) => player.readyState !== "ready",
    );

    if (pendingPlayers.length === 0) {
      await transitionMatchToVeto(matchId);
      return;
    }

    const timeoutPayload = {
      reason: "ready-check-timeout",
      droppedPlayerIds: pendingPlayers.map((player) => player.playerId),
      requeuedPlayerIds: readyPlayers.map((player) => player.playerId),
    };
    const cancelResult = await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'cancelled',
          "resultPayload" = $2::jsonb,
          "updatedAt" = now()
        where "id" = $1
          and "status" = 'ready_check'
        returning "id"
      `,
      [matchId, JSON.stringify(timeoutPayload)],
    );

    if ((cancelResult.rowCount ?? 0) === 0) {
      return;
    }

    await requeueReadyPlayers(match.queueId, readyPlayers);
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

    const [queue, settings] = await Promise.all([
      getQueueById(match.queueId),
      getPickupSettings(),
    ]);
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
      captainIds[Math.floor(Math.random() * captainIds.length)] ??
      captainIds[0]!;
    const vetoDeadlineAt = new Date(
      Date.now() + settings.vetoTurnDurationSeconds * 1000,
    );
    const vetoState: PickupVetoState = {
      availableMaps: maps,
      bannedMaps: [],
      turnCaptainPlayerId,
      turns: [],
    };

    const transitionResult = await pool.query(
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
          and "status" = 'ready_check'
        returning "id"
      `,
      [matchId, vetoDeadlineAt, turnCaptainPlayerId, JSON.stringify(vetoState)],
    );

    if ((transitionResult.rowCount ?? 0) === 0) {
      return;
    }

    scheduleVetoTimer(matchId, vetoDeadlineAt);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    emitMatchDetailUpdate(matchId, "live");
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

  async function abortPickupMatch(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    clearReadyTimer(matchId);
    clearVetoTimer(matchId);
    await cancelPendingSubRequestsForMatch(matchId, { resumeVeto: false });

    const match = await getLatestMatchById(matchId);
    if (!match) {
      throw new Error("Pickup match was not found.");
    }

    if (!ABORTABLE_PICKUP_STATUS_SET.has(match.status)) {
      return {
        aborted: false,
        matchId,
        status: match.status,
        warning: "Pickup match is already inactive.",
      };
    }

    const players = await getMatchPlayers(matchId);
    const adminSteamId =
      typeof payload.adminSteamId === "string" && payload.adminSteamId.trim()
        ? payload.adminSteamId.trim()
        : null;
    const requestedAt =
      typeof payload.requestedAt === "string" && payload.requestedAt.trim()
        ? payload.requestedAt.trim()
        : new Date().toISOString();
    const abortPayload = {
      reason: "admin-abort",
      abortedAt: new Date().toISOString(),
      adminSteamId,
      previousStatus: match.status,
      requestedAt,
      requeuedPlayerIds: [],
      ratingApplied: false,
    };

    const updateResult = await pool.query<{ status: PickupMatchRow["status"] }>(
      `
        update "PickupMatch"
        set
          "status" = 'cancelled',
          "readyDeadlineAt" = null,
          "vetoDeadlineAt" = null,
          "currentCaptainPlayerId" = null,
          "resultPayload" = $2::jsonb,
          "updatedAt" = now()
        where
          "id" = $1
          and "status" in (
            'ready_check',
            'veto',
            'provisioning',
            'server_ready',
            'live'
          )
        returning "status"
      `,
      [matchId, JSON.stringify(abortPayload)],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      const latestMatch = await getLatestMatchById(matchId);
      return {
        aborted: false,
        matchId,
        status: latestMatch?.status ?? match.status,
        warning: "Pickup match is already inactive.",
      };
    }

    await recordProvisionEvent(matchId, "admin-abort", abortPayload);
    await broadcastPublicState();
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    emitMatchDetailUpdate(matchId, "result");

    return {
      aborted: true,
      matchId,
      previousStatus: match.status,
      status: "cancelled" as const,
    };
  }

  async function applyProvisionResult(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match) {
      throw new Error("Pickup match was not found.");
    }

    if (match.status === "completed" || match.status === "cancelled") {
      return;
    }

    if (!["provisioning", "server_ready", "live"].includes(match.status)) {
      throw new Error("Pickup match is not awaiting provisioning.");
    }

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
      typeof payload.joinAddress === "string" &&
      payload.joinAddress.trim().length > 0
        ? payload.joinAddress.trim()
        : `${ip}:${port}`;

    const updateResult = await pool.query(
      `
        update "PickupMatch"
        set
          "status" = $2::"PickupMatchStatus",
          "serverIp" = $3,
          "serverPort" = $4,
          "serverJoinAddress" = $5,
          "serverLocationCountryCode" = $6,
          "serverLocationCountryName" = $7,
          "serverProvisionedAt" = now(),
          "provisionPayload" = coalesce("provisionPayload", '{}'::jsonb) || $8::jsonb,
          "updatedAt" = now()
        where
          "id" = $1
          and "status" in ('provisioning', 'server_ready', 'live')
        returning "id"
      `,
      [
        matchId,
        match.status === "live" ? "live" : "server_ready",
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

    if ((updateResult.rowCount ?? 0) === 0) {
      return;
    }

    await recordProvisionEvent(matchId, "provisioned", payload);
    const players = await getMatchPlayers(matchId);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  function getProvisionerBaseUrl(provisionApiUrl: string) {
    return new URL("/", provisionApiUrl).toString().replace(/\/$/, "");
  }

  async function provisionerAdminFetch(
    settings: PickupSettingsRow,
    path: string,
    init?: RequestInit,
  ) {
    if (!settings.provisionApiUrl) {
      throw new Error("Provision API URL is not configured.");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    if (settings.provisionAuthToken) {
      headers.Authorization = `Bearer ${settings.provisionAuthToken}`;
    }

    const response = await fetch(`${getProvisionerBaseUrl(settings.provisionApiUrl)}${path}`, {
      ...init,
      headers,
    });
    const text = await response.text();
    const payload =
      text.length > 0
        ? (() => {
            try {
              return JSON.parse(text) as Record<string, unknown>;
            } catch {
              return { raw: text } satisfies Record<string, unknown>;
            }
          })()
        : {};

    if (!response.ok) {
      const message =
        typeof payload.error === "string"
          ? payload.error
          : `Provisioner request failed with HTTP ${response.status}.`;
      throw new Error(message);
    }

    return payload;
  }

  async function buildProvisionPayload(match: PickupMatchRow) {
    const [players, queue] = await Promise.all([
      getMatchPlayers(match.id),
      getQueueById(match.queueId),
    ]);
    const ratingRows = await pool.query<{
      displayRating: number;
      personaName: string;
      playerId: string;
      steamId: string;
    }>(
      `
        select
          r."displayRating",
          p."personaName",
          p."id" as "playerId",
          p."steamId"
        from "PickupPlayerSeasonRating" r
        inner join "PickupPlayer" p on p."id" = r."playerId"
        where r."seasonId" = $1
      `,
      [match.seasonId],
    );

    if (!match.finalMapKey) {
      throw new Error("Pickup match is missing a final map.");
    }

    return {
      payload: {
        captains: match.balanceSummary?.captainPlayerIds ?? null,
        finalMapKey: match.finalMapKey,
        matchId: match.id,
        queue: queue
          ? {
              id: queue.id,
              name: queue.name,
              playerCount: queue.playerCount,
              slug: queue.slug,
              teamSize: queue.teamSize,
            }
          : undefined,
        queueId: match.queueId,
        ratings: ratingRows.rows.map((row) => ({
          displayRating: row.displayRating,
          personaName: row.personaName,
          playerId: row.playerId,
          steamId: row.steamId,
        })),
        seasonId: match.seasonId,
        teams: {
          left: players
            .filter((player) => player.team === "left")
            .map((player) => ({
              displayRating: player.displayBefore,
              personaName: player.personaName,
              playerId: player.playerId,
              steamId: player.steamId,
            })),
          right: players
            .filter((player) => player.team === "right")
            .map((player) => ({
              displayRating: player.displayBefore,
              personaName: player.personaName,
              playerId: player.playerId,
              steamId: player.steamId,
            })),
        },
      },
      players,
    };
  }

  async function syncServerReadySubstitution(matchId: string) {
    const [settings, match] = await Promise.all([
      getPickupSettings(),
      getLatestMatchById(matchId),
    ]);
    if (!match || match.status !== "server_ready") {
      return;
    }

    const slotsPayload = await provisionerAdminFetch(settings, "/api/admin/slots");
    const slots = Array.isArray(slotsPayload.slots)
      ? (slotsPayload.slots as Array<Record<string, unknown>>)
      : [];
    const activeSlot = slots.find((slot) => {
      const metadata =
        slot.metadata && typeof slot.metadata === "object"
          ? (slot.metadata as Record<string, unknown>)
          : null;
      return metadata?.matchId === matchId;
    });

    const slotState =
      activeSlot?.slot && typeof activeSlot.slot === "object"
        ? (activeSlot.slot as Record<string, unknown>)
        : null;
    const slotId =
      typeof slotState?.slotId === "number"
        ? slotState.slotId
        : typeof slotState?.slotId === "string"
          ? Number(slotState.slotId)
          : null;
    if (!slotId || !Number.isFinite(slotId)) {
      throw new Error("No active provisioner slot was found for this pickup.");
    }

    const { payload } = await buildProvisionPayload(match);
    await provisionerAdminFetch(
      settings,
      `/api/admin/slots/${slotId}/pickup-metadata`,
      {
        body: JSON.stringify(payload),
        method: "POST",
      },
    );
  }

  async function requestProvision(matchId: string) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status !== "provisioning") {
      return;
    }

    const failProvision = async (
      reason: string,
      payload?: Record<string, unknown>,
    ) => {
      const players = await getMatchPlayers(matchId);
      const requeuedPlayerIds = players.map((player) => player.playerId);
      const failurePayload = {
        ...(payload ?? {}),
        reason,
        requeuedPlayerIds,
      };
      const cancelResult = await pool.query(
        `
          update "PickupMatch"
          set
            "status" = 'cancelled',
            "resultPayload" = $2::jsonb,
            "updatedAt" = now()
          where "id" = $1
            and "status" = 'provisioning'
          returning "id"
        `,
        [matchId, JSON.stringify(failurePayload)],
      );

      if ((cancelResult.rowCount ?? 0) === 0) {
        return;
      }

      await requeueReadyPlayers(match.queueId, players);
      await recordProvisionEvent(matchId, "provision-failed", {
        ...failurePayload,
      });
      await broadcastPublicState();
      for (const player of players) {
        await emitPlayerState(player.playerId);
      }
    };

    const settings = await getPickupSettings();
    if (!settings.provisionApiUrl) {
      await recordProvisionEvent(matchId, "provision-error", {
        error: "Provision API URL is not configured.",
      });
      await failProvision("provision-not-configured");
      return;
    }

    let payload: Record<string, unknown>;
    try {
      ({ payload } = await buildProvisionPayload(match));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordProvisionEvent(matchId, "provision-error", {
        error: message,
        stage: "build-payload",
      });
      await failProvision("provision-payload-error", {
        error: message,
      });
      return;
    }

    await recordProvisionEvent(matchId, "request", payload);
    const requestBody = JSON.stringify(payload);

    for (const [attemptIndex, delayMs] of PROVISION_RETRY_DELAYS_MS.entries()) {
      const attempt = attemptIndex + 1;

      if (delayMs > 0) {
        await recordProvisionEvent(matchId, "retry-wait", {
          attempt,
          delayMs,
        });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const latestMatch = await getLatestMatchById(matchId);
      if (!latestMatch || latestMatch.status !== "provisioning") {
        return;
      }

      try {
        const response = await fetch(settings.provisionApiUrl, {
          body: requestBody,
          headers: {
            "Content-Type": "application/json",
            ...(settings.provisionAuthToken
              ? {
                  Authorization: `Bearer ${settings.provisionAuthToken}`,
                }
              : {}),
          },
          method: "POST",
        });

        const text = await response.text();
        let parsed: Record<string, unknown> | null = null;
        try {
          parsed =
            text.length > 0
              ? (JSON.parse(text) as Record<string, unknown>)
              : null;
        } catch {
          parsed = { raw: text };
        }

        await recordProvisionEvent(matchId, "response", {
          attempt,
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
          return;
        }

        const retryable = response.status === 409 || response.status >= 500;
        if (retryable && attempt < PROVISION_RETRY_DELAYS_MS.length) {
          continue;
        }

        await failProvision("provision-request-failed", {
          attempt,
          payload: parsed ?? undefined,
          status: response.status,
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordProvisionEvent(matchId, "response-error", {
          attempt,
          error: message,
        });

        if (attempt < PROVISION_RETRY_DELAYS_MS.length) {
          continue;
        }

        await failProvision("provision-request-error", {
          attempt,
          error: message,
        });
        return;
      }
    }
  }

  async function getLockedMatchPlayersForUpdate(
    client: PoolClient,
    matchId: string,
  ) {
    const result = await client.query<PickupMatchPlayerRow>(
      `
        select
          mp."id" as "matchPlayerId",
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
          p."id" as "id",
          p."personaName",
          coalesce(p."customAvatarUrl", p."avatarUrl") as "avatarUrl",
          p."countryCode",
          p."profileUrl",
          p."steamId"
        from "PickupMatchPlayer" mp
        inner join "PickupPlayer" p on p."id" = mp."playerId"
        where mp."matchId" = $1
        order by mp."joinedAt" asc, p."personaName" asc
        for update of mp
      `,
      [matchId],
    );

    return result.rows;
  }

  async function getActiveMapsWithClient(client: PoolClient, queueId: string) {
    const result = await client.query<{ mapKey: string }>(
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

  async function requestSubstitute(
    session: PickupSessionIdentity,
    targetPlayerId: string,
  ) {
    const normalizedTargetPlayerId = targetPlayerId.trim();
    if (!normalizedTargetPlayerId) {
      throw new Error("A substitute player is required.");
    }

    const match = await getLatestPlayerActiveMatch(session.player.id);
    if (!match || !["veto", "server_ready"].includes(match.status)) {
      throw new Error(
        "Substitutes can only be requested during veto or server warmup.",
      );
    }

    if (normalizedTargetPlayerId === session.player.id) {
      throw new Error("You cannot substitute yourself with yourself.");
    }

    const [pendingMatchRequest, players, targetPlayer] = await Promise.all([
      getPendingMatchSubRequest(match.id),
      getMatchPlayers(match.id),
      getPickupPlayerIdentityById(normalizedTargetPlayerId),
    ]);

    if (!players.some((player) => player.playerId === session.player.id)) {
      throw new Error("You are not on the active pickup roster.");
    }

    if (pendingMatchRequest) {
      throw new Error("This pickup already has a pending substitute request.");
    }

    if (!targetPlayer) {
      throw new Error("The selected substitute player could not be found.");
    }

    if (players.some((player) => player.playerId === targetPlayer.id)) {
      throw new Error("That player is already on the active pickup roster.");
    }

    const [
      targetLock,
      targetActiveMatch,
      targetIncomingRequest,
      targetOutgoingRequest,
    ] = await Promise.all([
      getActivePlayerLock(targetPlayer.id),
      getLatestPlayerActiveMatch(targetPlayer.id),
      getPendingSubRequestForTarget(targetPlayer.id),
      getPendingSubRequestForRequester(targetPlayer.id),
    ]);

    if (targetLock) {
      throw new Error("That player is locked from matchmaking right now.");
    }

    if (targetActiveMatch && targetActiveMatch.id !== match.id) {
      throw new Error("That player is already in another active pickup.");
    }

    if (targetIncomingRequest || targetOutgoingRequest) {
      throw new Error("That player already has a pending substitute request.");
    }

    const expiresAt = new Date(Date.now() + SUBSTITUTE_REQUEST_EXPIRY_MS);
    const client = await pool.connect();
    let requestId: string | null = null;
    try {
      await client.query("begin");

      const lockedMatchResult = await client.query<{ status: PickupMatchRow["status"] }>(
        `
          select "status"
          from "PickupMatch"
          where "id" = $1
          for update
        `,
        [match.id],
      );
      const lockedStatus = lockedMatchResult.rows[0]?.status;
      if (!lockedStatus || !["veto", "server_ready"].includes(lockedStatus)) {
        throw new Error(
          "Substitutes can only be requested during veto or server warmup.",
        );
      }

      const pendingRequestResult = await client.query<{ id: string }>(
        `
          select "id"
          from "PickupMatchSubRequest"
          where
            "matchId" = $1
            and "status" = 'pending'
            and "expiresAt" > now()
          limit 1
        `,
        [match.id],
      );
      if (pendingRequestResult.rows[0]) {
        throw new Error("This pickup already has a pending substitute request.");
      }

      const lockedRosterResult = await client.query<{ playerId: string }>(
        `
          select "playerId"
          from "PickupMatchPlayer"
          where "matchId" = $1
          for update
        `,
        [match.id],
      );
      const lockedRosterPlayerIds = new Set(
        lockedRosterResult.rows.map((row) => row.playerId),
      );
      if (!lockedRosterPlayerIds.has(session.player.id)) {
        throw new Error("You are not on the active pickup roster.");
      }
      if (lockedRosterPlayerIds.has(targetPlayer.id)) {
        throw new Error("That player is already on the active pickup roster.");
      }

      const insertResult = await client.query<{ id: string }>(
        `
          insert into "PickupMatchSubRequest" (
            "id",
            "matchId",
            "requesterPlayerId",
            "targetPlayerId",
            "status",
            "expiresAt",
            "createdAt",
            "updatedAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            'pending',
            $4,
            now(),
            now()
          )
          returning "id"
        `,
        [match.id, session.player.id, targetPlayer.id, expiresAt],
      );
      requestId = insertResult.rows[0]?.id ?? null;

      if (lockedStatus === "veto") {
        clearVetoTimer(match.id);
        await client.query(
          `
            update "PickupMatch"
            set
              "vetoDeadlineAt" = null,
              "updatedAt" = now()
            where "id" = $1
              and "status" = 'veto'
          `,
          [match.id],
        );
      }

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    if (requestId) {
      scheduleSubRequestTimer(requestId, expiresAt);
    }

    await emitSubRequestPlayerStates(match.id, session.player.id, targetPlayer.id);
    return getPlayerState(session.player);
  }

  async function cancelSubstituteRequest(session: PickupSessionIdentity) {
    const request = await getPendingSubRequestForRequester(session.player.id);
    if (!request) {
      throw new Error("You do not have a pending substitute request.");
    }

    await resolvePendingSubRequest(request.id, "cancelled");
    return getPlayerState(session.player);
  }

  async function acceptSubstituteRequest(
    requestId: string,
    targetPlayerId: string,
  ) {
    const settings = await getPickupSettings();
    const client = await pool.connect();
    let syncServerReady = false;
    let syncPlayerIds: string[] = [];
    let syncMatchId: string | null = null;

    try {
      await client.query("begin");

      const lockedRequestResult = await client.query<{
        expiresAt: Date;
        id: string;
        matchId: string;
        queueId: string;
        seasonId: string;
        stage: PickupMatchRow["status"];
        targetPlayerId: string;
        requesterPlayerId: string;
      }>(
        `
          select
            sr."id",
            sr."matchId",
            sr."requesterPlayerId",
            sr."targetPlayerId",
            sr."expiresAt",
            m."status" as "stage",
            m."queueId",
            m."seasonId"
          from "PickupMatchSubRequest" sr
          inner join "PickupMatch" m on m."id" = sr."matchId"
          where
            sr."id" = $1
            and sr."status" = 'pending'
          for update of sr, m
        `,
        [requestId],
      );
      const lockedRequest = lockedRequestResult.rows[0];
      if (!lockedRequest) {
        throw new Error("That substitute request is no longer available.");
      }

      if (lockedRequest.targetPlayerId !== targetPlayerId) {
        throw new Error("Only the selected substitute player can accept.");
      }

      if (!["veto", "server_ready"].includes(lockedRequest.stage)) {
        throw new Error("That substitute request is no longer active.");
      }

      if (lockedRequest.expiresAt.getTime() <= Date.now()) {
        throw new Error("That substitute request has already expired.");
      }

      const roster = await getLockedMatchPlayersForUpdate(
        client,
        lockedRequest.matchId,
      );
      if (
        !roster.some(
          (player) => player.playerId === lockedRequest.requesterPlayerId,
        )
      ) {
        throw new Error("The requester is no longer on this pickup roster.");
      }

      if (
        roster.some((player) => player.playerId === lockedRequest.targetPlayerId)
      ) {
        throw new Error("The substitute player is already on this pickup roster.");
      }

      const targetPlayerResult = await client.query<PickupPlayerIdentity>(
        `
          select
            "id",
            "steamId",
            "personaName",
            coalesce("customAvatarUrl", "avatarUrl") as "avatarUrl",
            "countryCode",
            "profileUrl"
          from "PickupPlayer"
          where "id" = $1
          limit 1
        `,
        [lockedRequest.targetPlayerId],
      );
      const targetPlayer = targetPlayerResult.rows[0];
      if (!targetPlayer) {
        throw new Error("The substitute player could not be found.");
      }

      const targetLockResult = await client.query<{ id: string }>(
        `
          select "id"
          from "PickupPlayerLock"
          where
            "playerId" = $1
            and "revokedAt" is null
            and ("expiresAt" is null or "expiresAt" > now())
          limit 1
        `,
        [lockedRequest.targetPlayerId],
      );
      if (targetLockResult.rows[0]) {
        throw new Error("That player is locked from matchmaking right now.");
      }

      const targetActiveMatchResult = await client.query<{ matchId: string }>(
        `
          select mp."matchId"
          from "PickupMatchPlayer" mp
          inner join "PickupMatch" m on m."id" = mp."matchId"
          where
            mp."playerId" = $1
            and mp."matchId" <> $2
            and (
              m."status" in ('provisioning', 'server_ready', 'live')
              or (m."status" = 'ready_check' and m."readyDeadlineAt" > now())
              or m."status" = 'veto'
            )
          limit 1
        `,
        [lockedRequest.targetPlayerId, lockedRequest.matchId],
      );
      if (targetActiveMatchResult.rows[0]) {
        throw new Error("That player is already in another active pickup.");
      }

      const queueResult = await client.query<{
        name: string;
        slug: string;
        teamSize: number;
      }>(
        `
          select "name", "slug", "teamSize"
          from "PickupQueue"
          where "id" = $1
          limit 1
        `,
        [lockedRequest.queueId],
      );
      const queue = queueResult.rows[0];
      if (!queue) {
        throw new Error("Pickup queue could not be found.");
      }

      const seasonResult = await client.query<{ startingRating: number }>(
        `
          select "startingRating"
          from "PickupSeason"
          where "id" = $1
          limit 1
        `,
        [lockedRequest.seasonId],
      );
      const season = seasonResult.rows[0];
      if (!season) {
        throw new Error("Pickup season could not be found.");
      }

      const targetRatingResult = await client.query<PickupRatingRow>(
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
            'season-starting-rating',
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
          lockedRequest.seasonId,
          lockedRequest.targetPlayerId,
          season.startingRating,
          ratingEnv.sigma,
          season.startingRating,
        ],
      );
      const targetRating = targetRatingResult.rows[0];
      if (!targetRating) {
        throw new Error("The substitute rating could not be loaded.");
      }

      const remainingRoster = roster.filter(
        (player) => player.playerId !== lockedRequest.requesterPlayerId,
      );
      const ratingRowsResult = await client.query<PickupRatingRow>(
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
          where
            "seasonId" = $1
            and "playerId" = any($2::text[])
        `,
        [
          lockedRequest.seasonId,
          [
            ...remainingRoster.map((player) => player.playerId),
            lockedRequest.targetPlayerId,
          ],
        ],
      );
      const ratingByPlayerId = new Map(
        ratingRowsResult.rows.map((row) => [row.playerId, row]),
      );
      ratingByPlayerId.set(targetRating.playerId, targetRating);

      const removedQueueMembership = await client.query<{ joinedAt: Date }>(
        `
          delete from "PickupQueueMember"
          where "playerId" = $1
          returning "joinedAt"
        `,
        [lockedRequest.targetPlayerId],
      );
      const targetJoinedAt =
        removedQueueMembership.rows[0]?.joinedAt ?? new Date();

      const balancedMembers = chooseBalancedTeams(
        queue.teamSize,
        [
          ...remainingRoster.map((player) => {
            const rating = ratingByPlayerId.get(player.playerId) ?? {
              displayRating: player.displayBefore,
              gamesPlayed: 0,
              losses: 0,
              mu: player.muBefore,
              playerId: player.playerId,
              sigma: player.sigmaBefore,
              wins: 0,
            };

            return {
              ...player,
              balanceRating: rating.displayRating,
              balanceRatingSource: "pickup" as const,
              queueMemberId: `match:${player.matchPlayerId}`,
              rating,
            };
          }),
          {
            ...targetPlayer,
            balanceRating: targetRating.displayRating,
            balanceRatingSource: "pickup" as const,
            joinedAt: targetJoinedAt,
            playerId: targetPlayer.id,
            queueMemberId: `sub:${lockedRequest.id}`,
            rating: targetRating,
          },
        ],
      );

      await client.query(
        `
          delete from "PickupMatchPlayer"
          where
            "matchId" = $1
            and "playerId" = $2
        `,
        [lockedRequest.matchId, lockedRequest.requesterPlayerId],
      );

      for (const player of remainingRoster) {
        const team = balancedMembers.left.some(
          (member) => member.playerId === player.playerId,
        )
          ? "left"
          : "right";
        const isCaptain =
          balancedMembers.balanceSummary.captainPlayerIds.left ===
            player.playerId ||
          balancedMembers.balanceSummary.captainPlayerIds.right ===
            player.playerId;
        await client.query(
          `
            update "PickupMatchPlayer"
            set
              "team" = $3::"PickupTeamSide",
              "isCaptain" = $4,
              "updatedAt" = now()
            where
              "matchId" = $1
              and "playerId" = $2
          `,
          [lockedRequest.matchId, player.playerId, team, isCaptain],
        );
      }

      const targetTeam = balancedMembers.left.some(
        (member) => member.playerId === lockedRequest.targetPlayerId,
      )
        ? "left"
        : "right";
      const targetIsCaptain =
        balancedMembers.balanceSummary.captainPlayerIds.left ===
          lockedRequest.targetPlayerId ||
        balancedMembers.balanceSummary.captainPlayerIds.right ===
          lockedRequest.targetPlayerId;
      await client.query(
        `
          insert into "PickupMatchPlayer" (
            "id",
            "matchId",
            "playerId",
            "joinedAt",
            "readyState",
            "readyConfirmedAt",
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
            'ready',
            now(),
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
          lockedRequest.matchId,
          lockedRequest.targetPlayerId,
          targetJoinedAt,
          targetTeam,
          targetIsCaptain,
          targetRating.mu,
          targetRating.sigma,
          targetRating.displayRating,
        ],
      );

      let nextVetoDeadlineAt: Date | null = null;
      if (lockedRequest.stage === "veto") {
        const activeMaps = await getActiveMapsWithClient(
          client,
          lockedRequest.queueId,
        );
        const captainIds = [
          balancedMembers.balanceSummary.captainPlayerIds.left,
          balancedMembers.balanceSummary.captainPlayerIds.right,
        ];
        const turnCaptainPlayerId =
          captainIds[Math.floor(Math.random() * captainIds.length)] ??
          captainIds[0]!;
        nextVetoDeadlineAt = new Date(
          Date.now() + settings.vetoTurnDurationSeconds * 1000,
        );

        await client.query(
          `
            update "PickupMatch"
            set
              "balanceSummary" = $2::jsonb,
              "finalMapKey" = null,
              "bannedMapKeys" = null,
              "currentCaptainPlayerId" = $3,
              "vetoDeadlineAt" = $4,
              "vetoState" = $5::jsonb,
              "updatedAt" = now()
            where
              "id" = $1
              and "status" = 'veto'
          `,
          [
            lockedRequest.matchId,
            JSON.stringify(balancedMembers.balanceSummary),
            turnCaptainPlayerId,
            nextVetoDeadlineAt,
            JSON.stringify({
              availableMaps: activeMaps,
              bannedMaps: [],
              turnCaptainPlayerId,
              turns: [],
            } satisfies PickupVetoState),
          ],
        );
      } else {
        await client.query(
          `
            update "PickupMatch"
            set
              "balanceSummary" = $2::jsonb,
              "currentCaptainPlayerId" = null,
              "updatedAt" = now()
            where
              "id" = $1
              and "status" = 'server_ready'
          `,
          [
            lockedRequest.matchId,
            JSON.stringify(balancedMembers.balanceSummary),
          ],
        );
        syncServerReady = true;
      }

      await client.query(
        `
          update "PickupMatchSubRequest"
          set
            "status" = 'accepted',
            "respondedAt" = now(),
            "updatedAt" = now()
          where "id" = $1
        `,
        [lockedRequest.id],
      );

      await client.query(
        `
          insert into "PickupMatchSubstitution" (
            "id",
            "matchId",
            "outPlayerId",
            "inPlayerId",
            "acceptedRequestId",
            "stage",
            "createdAt"
          )
          values (
            gen_random_uuid()::text,
            $1,
            $2,
            $3,
            $4,
            $5::"PickupMatchSubstitutionStage",
            now()
          )
        `,
        [
          lockedRequest.matchId,
          lockedRequest.requesterPlayerId,
          lockedRequest.targetPlayerId,
          lockedRequest.id,
          lockedRequest.stage,
        ],
      );

      await client.query("commit");
      clearSubRequestTimer(lockedRequest.id);

      syncPlayerIds = [
        ...new Set(
          roster
            .map((player) => player.playerId)
            .filter((playerId) => playerId !== lockedRequest.requesterPlayerId)
            .concat([
              lockedRequest.requesterPlayerId,
              lockedRequest.targetPlayerId,
            ]),
        ),
      ];
      syncMatchId = lockedRequest.matchId;

      if (nextVetoDeadlineAt) {
        scheduleVetoTimer(lockedRequest.matchId, nextVetoDeadlineAt);
      }
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    if (syncMatchId) {
      await broadcastPublicState();
      await emitStatesForPlayerIds(syncPlayerIds);
    }

    if (syncServerReady && syncMatchId) {
      try {
        await syncServerReadySubstitution(syncMatchId);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        await recordProvisionEvent(syncMatchId, "substitution-sync-error", {
          error: message,
        });
        emitPickupErrorToPlayers(
          syncPlayerIds,
          "Substitute accepted, but the live server roster could not be refreshed automatically.",
        );
      }
    }
  }

  async function respondToSubstituteRequest(
    session: PickupSessionIdentity,
    requestId: string,
    action: "accept" | "decline",
  ) {
    const request = await getPendingSubRequestById(requestId);
    if (!request || request.targetPlayerId !== session.player.id) {
      throw new Error("That substitute request is no longer available.");
    }

    if (action === "decline") {
      await resolvePendingSubRequest(request.id, "declined");
      return getPlayerState(session.player);
    }

    await acceptSubstituteRequest(request.id, session.player.id);
    return getPlayerState(session.player);
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

    const pendingSubRequest = await getPendingMatchSubRequest(matchId);
    if (pendingSubRequest) {
      throw new Error("Veto is paused while a substitute request is pending.");
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

    const availableMaps = vetoState.availableMaps.filter(
      (value) => value !== mapKey,
    );
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
      const provisionTransitionResult = await pool.query(
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
            and "status" = 'veto'
          returning "id"
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

      if ((provisionTransitionResult.rowCount ?? 0) === 0) {
        return;
      }

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
    const settings = await getPickupSettings();
    const vetoDeadlineAt = new Date(
      Date.now() + settings.vetoTurnDurationSeconds * 1000,
    );
    const vetoUpdateResult = await pool.query(
      `
        update "PickupMatch"
        set
          "currentCaptainPlayerId" = $2,
          "vetoDeadlineAt" = $3,
          "bannedMapKeys" = $4::jsonb,
          "vetoState" = $5::jsonb,
          "updatedAt" = now()
        where "id" = $1
          and "status" = 'veto'
        returning "id"
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

    if ((vetoUpdateResult.rowCount ?? 0) === 0) {
      return;
    }

    scheduleVetoTimer(matchId, vetoDeadlineAt);
    const players = await getMatchPlayers(matchId);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  async function handleVetoTimeout(matchId: string) {
    await applyBan(matchId, null, undefined, "timeout");
  }

  async function joinQueue(
    session: PickupSessionIdentity,
    queueRef?: { queueId?: string; queueSlug?: string },
  ) {
    const queue =
      (queueRef?.queueId
        ? await getQueueById(queueRef.queueId)
        : queueRef?.queueSlug
          ? await getQueueBySlug(queueRef.queueSlug)
          : await getPrimaryQueue()) ?? null;
    if (!queue || !queue.enabled) {
      throw new Error("The pickup queue is currently unavailable.");
    }

    const activeSeason = await getActiveSeason(queue.id);
    if (!activeSeason) {
      throw new Error("No active pickup season is configured.");
    }

    const [activeMatch, membership, activeLock] = await Promise.all([
      getLatestPlayerActiveMatch(session.player.id),
      getQueueMembership(session.player.id),
      getActivePlayerLock(session.player.id),
    ]);
    if (activeLock) {
      await leaveQueueByPlayerId(session.player.id);
      throw new Error(formatLockMessage(activeLock));
    }

    if (activeMatch || membership) {
      return getPlayerState(session.player);
    }

    await getOrCreatePlayerSeasonRating(session.player, activeSeason);
    const queueCountBeforeJoinResult = await pool.query<{ count: string }>(
      `
        select count(*)::text as count
        from "PickupQueueMember"
        where "queueId" = $1
      `,
      [queue.id],
    );
    const queueCountBeforeJoin = Number(
      queueCountBeforeJoinResult.rows[0]?.count ?? "0",
    );
    const insertResult = await pool.query(
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

    if (insertResult.rowCount) {
      const currentPlayers = queueCountBeforeJoin + 1;
      const action = queueCountBeforeJoin === 0 ? "opened" : "joined";

      void notifyDiscordWebhook({
        action,
        currentPlayers,
        joinedAt: new Date().toISOString(),
        player: {
          avatarUrl: session.player.avatarUrl,
          id: session.player.id,
          personaName: stripQuakeColors(session.player.personaName).trim(),
          profileUrl: session.player.profileUrl,
          steamId: session.player.steamId,
        },
        queue: {
          id: queue.id,
          name: queue.name,
          playerCount: queue.playerCount,
          slug: queue.slug,
          teamSize: queue.teamSize,
        },
        type: "pickup.queue_opened",
      });
    }

    await broadcastPublicState();
    await emitPlayerState(session.player.id);
    await tryStartMatchmaking(queue.id);
    return getPlayerState(session.player);
  }

  async function leaveQueueByPlayerId(playerId: string) {
    await pool.query(`delete from "PickupQueueMember" where "playerId" = $1`, [
      playerId,
    ]);

    await broadcastPublicState();
    await emitPlayerState(playerId);
  }

  async function leaveQueue(session: PickupSessionIdentity) {
    await leaveQueueByPlayerId(session.player.id);
    return getPlayerState(session.player);
  }

  async function autoLeaveDisconnectedPlayerQueue(playerId: string) {
    if ((connectedPickupSocketsByPlayerId.get(playerId)?.size ?? 0) > 0) {
      return;
    }

    const [activeMatch, membership] = await Promise.all([
      getLatestPlayerActiveMatch(playerId),
      getQueueMembership(playerId),
    ]);
    if (activeMatch || !membership) {
      return;
    }

    await leaveQueueByPlayerId(playerId);
    console.log(`pickup auto-left disconnected player ${playerId}`);
  }

  function scheduleQueueDisconnectLeave(playerId: string) {
    clearQueueDisconnectTimer(playerId);
    const timeout = setTimeout(() => {
      queueDisconnectTimers.delete(playerId);
      void autoLeaveDisconnectedPlayerQueue(playerId).catch((error) => {
        console.error(
          "Failed to auto-leave disconnected pickup player:",
          error,
        );
      });
    }, config.pickupQueueDisconnectGraceMs);

    queueDisconnectTimers.set(playerId, timeout);
  }

  async function markReady(session: PickupSessionIdentity) {
    const match = await getLatestPlayerActiveMatch(session.player.id);
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
    const match = await getLatestPlayerActiveMatch(session.player.id);
    if (!match || match.status !== "veto") {
      throw new Error("You are not in an active veto.");
    }

    await applyBan(match.id, session.player.id, mapKey, "captain");
    return getPlayerState(session.player);
  }

  async function applyMatchLive(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    await cancelPendingSubRequestsForMatch(matchId);
    const match = await getLatestMatchById(matchId);
    if (
      !match ||
      match.status === "completed" ||
      match.status === "cancelled"
    ) {
      return;
    }

    if (!["server_ready", "live"].includes(match.status)) {
      throw new Error("Pickup match server is not ready yet.");
    }

    const updateResult = await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'live',
          "liveStartedAt" = coalesce("liveStartedAt", now()),
          "updatedAt" = now()
        where
          "id" = $1
          and "status" in ('server_ready', 'live')
        returning "id"
      `,
      [matchId],
    );

    if ((updateResult.rowCount ?? 0) === 0) {
      return;
    }

    await recordProvisionEvent(matchId, "live", payload);
    const players = await getMatchPlayers(matchId);
    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
  }

  async function applyMatchResult(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    await cancelPendingSubRequestsForMatch(matchId);
    const match = await getLatestMatchById(matchId);
    if (
      !match ||
      match.status === "completed" ||
      match.status === "cancelled"
    ) {
      return;
    }

    const winnerTeam =
      payload.winnerTeam === "left" || payload.winnerTeam === "right"
        ? payload.winnerTeam
        : null;
    if (!winnerTeam) {
      throw new Error("Result callback must include winnerTeam.");
    }
    const finalScore =
      typeof payload.finalScore === "string" ? payload.finalScore : null;
    const shouldRate = shouldApplyPickupRating(finalScore);

    const players = await getMatchPlayers(matchId);
    const left = players.filter((player) => player.team === "left");
    const right = players.filter((player) => player.team === "right");
    const [leftRated, rightRated] = shouldRate
      ? (ratingEnv.rate(
          [
            left.map((player) =>
              createRating(player.muBefore, player.sigmaBefore),
            ),
            right.map((player) =>
              createRating(player.muBefore, player.sigmaBefore),
            ),
          ],
          winnerTeam === "left" ? [0, 1] : [1, 0],
        ) as Rating[][])
      : [
          left.map((player) =>
            createRating(player.muBefore, player.sigmaBefore),
          ),
          right.map((player) =>
            createRating(player.muBefore, player.sigmaBefore),
          ),
        ];

    const client = await pool.connect();
    try {
      await client.query("begin");
      const lockedMatchResult = await client.query<{
        status: PickupMatchRow["status"];
      }>(
        `
          select "status"
          from "PickupMatch"
          where "id" = $1
          for update
        `,
        [matchId],
      );
      const lockedStatus = lockedMatchResult.rows[0]?.status;
      if (
        !lockedStatus ||
        lockedStatus === "completed" ||
        lockedStatus === "cancelled"
      ) {
        await client.query("commit");
        return;
      }

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
            player.matchPlayerId,
            matchId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "left",
          ],
        );

        if (shouldRate) {
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
            player.matchPlayerId,
            matchId,
            rating.mu,
            rating.sigma,
            defaultDisplayRating(rating.mu),
            winnerTeam === "right",
          ],
        );

        if (shouldRate) {
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
          finalScore,
          JSON.stringify({
            ...payload,
            rated: shouldRate,
            unratedReason: shouldRate ? null : "insufficient_rounds",
          }),
        ],
      );

      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const completedMatch = await getLatestMatchById(matchId);

    for (const player of players) {
      await emitPlayerState(player.playerId);
    }
    await broadcastPublicState();

    if (completedMatch) {
      const completedPlayers = await getMatchPlayers(matchId);
      void notifyMatchCompleted(completedMatch, completedPlayers);
    }
    emitMatchDetailUpdate(matchId, "result");
  }

  async function applyMatchStats(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status === "cancelled") {
      return;
    }

    await applyPickupMatchStats(matchId, payload, getMatchPlayers);
    emitMatchDetailUpdate(matchId, "stats");
  }

  async function applyMatchChat(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status === "cancelled") {
      return;
    }

    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";
    const personaName =
      typeof payload.playerName === "string" ? payload.playerName.trim() : "";
    if (!message || !personaName) {
      return;
    }

    const steamId =
      typeof payload.playerSteamId === "string"
        ? payload.playerSteamId.trim()
        : "";
    const channel =
      typeof payload.channel === "string" && payload.channel.trim().length > 0
        ? payload.channel.trim()
        : "chat";
    const sentAt =
      typeof payload.sentAt === "string" &&
      !Number.isNaN(Date.parse(payload.sentAt))
        ? new Date(payload.sentAt)
        : new Date();

    let playerId: string | null = null;
    if (steamId) {
      const playerResult = await pool.query<{ id: string }>(
        `
          select "id"
          from "PickupPlayer"
          where "steamId" = $1
          limit 1
        `,
        [steamId],
      );
      playerId = playerResult.rows[0]?.id ?? null;
    }

    await pool.query(
      `
        insert into "PickupMatchChatEvent" (
          "id",
          "matchId",
          "playerId",
          "steamId",
          "personaName",
          "channel",
          "message",
          "sentAt",
          "createdAt"
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
          now()
        )
      `,
      [
        matchId,
        playerId,
        steamId || null,
        personaName,
        channel,
        message,
        sentAt,
      ],
    );
    emitMatchDetailUpdate(matchId, "chat");
  }

  async function emitSocketState(
    socket: Socket,
    session: PickupSessionIdentity | null,
  ) {
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
  const callbackApi = createPickupCallbackApi({
    applyMatchChat,
    applyMatchLive,
    applyMatchResult,
    applyMatchStats,
    applyProvisionResult,
    authenticatePickupSession,
    createSignature,
    getLatestMatchById,
    getPickupSettings,
    getPlayerState,
  });
  const {
    handleChatCallback,
    getPlayerStateByToken,
    handleLiveCallback,
    handleProvisionCallback,
    handleResultCallback,
    handleStatsCallback,
    verifyCallbackSignature,
  } = callbackApi;

  return {
    async getPublicState() {
      return getPublicState();
    },
    async getPlayerStateByToken(token: string) {
      return getPlayerStateByToken(token);
    },
    async hydrate() {
      await ensureBootstrapData();
      await hydratePendingSubRequests();
      await cleanupLockedQueueMembers("startup-locked");
      await cleanupExpiredQueueMembers("startup-max-age");
      await hydrateTimers();
      startQueueMemberCleanupLoop();
      scheduleRestartQueueCleanup();
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
    async handleSocketConnection(
      socket: Socket,
      session: PickupSessionIdentity | null,
    ) {
      socket.join("pickup:public");
      if (session) {
        trackConnectedPickupSocket(session.player.id, socket.id);
        socket.join(`pickup:player:${session.player.id}`);

        socket.on("disconnect", () => {
          const remainingSockets = untrackConnectedPickupSocket(
            session.player.id,
            socket.id,
          );
          if (remainingSockets > 0) {
            return;
          }

          scheduleQueueDisconnectLeave(session.player.id);
        });
      }

      await emitSocketState(socket, session);

      socket.on("pickup:queue:join", async (payload: unknown) => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        const queueId =
          typeof (payload as { queueId?: unknown })?.queueId === "string"
            ? (payload as { queueId: string }).queueId.trim()
            : "";
        const queueSlug =
          typeof (payload as { queueSlug?: unknown })?.queueSlug === "string"
            ? (payload as { queueSlug: string }).queueSlug.trim()
            : "";

        try {
          socket.emit(
            "pickup:state",
            await joinQueue(session, {
              queueId: queueId || undefined,
              queueSlug: queueSlug || undefined,
            }),
          );
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

      socket.on("pickup:sub:request", async (payload: unknown) => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        const targetPlayerId =
          typeof (payload as { targetPlayerId?: unknown })?.targetPlayerId ===
          "string"
            ? (payload as { targetPlayerId: string }).targetPlayerId.trim()
            : "";
        if (!targetPlayerId) {
          socket.emit("pickup:error", {
            message: "A substitute player is required.",
          });
          return;
        }

        try {
          socket.emit(
            "pickup:state",
            await requestSubstitute(session, targetPlayerId),
          );
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      socket.on("pickup:sub:cancel", async () => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        try {
          socket.emit("pickup:state", await cancelSubstituteRequest(session));
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

      socket.on("pickup:sub:respond", async (payload: unknown) => {
        if (!session) {
          socket.emit("pickup:error", { message: "Pickup login is required." });
          return;
        }

        const requestId =
          typeof (payload as { requestId?: unknown })?.requestId === "string"
            ? (payload as { requestId: string }).requestId.trim()
            : "";
        const action =
          typeof (payload as { action?: unknown })?.action === "string"
            ? (payload as { action: string }).action.trim()
            : "";
        if (!requestId || !["accept", "decline"].includes(action)) {
          socket.emit("pickup:error", {
            message: "A valid substitute response is required.",
          });
          return;
        }

        try {
          socket.emit(
            "pickup:state",
            await respondToSubstituteRequest(
              session,
              requestId,
              action as "accept" | "decline",
            ),
          );
        } catch (error) {
          socket.emit("pickup:error", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
    async handleProvisionCallback(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      return handleProvisionCallback(request, response);
    },
    async handleAdminAbortMatch(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      try {
        const matchId =
          typeof request.body?.matchId === "string"
            ? request.body.matchId.trim()
            : "";
        if (!matchId) {
          response
            .status(400)
            .json({ ok: false, error: "matchId is required." });
          return;
        }

        const reason =
          typeof request.body?.reason === "string"
            ? request.body.reason.trim()
            : "";
        if (reason !== "admin-abort") {
          response.status(400).json({
            ok: false,
            error: 'reason must be "admin-abort".',
          });
          return;
        }

        await verifyCallbackSignature(matchId, request);
        const result = await abortPickupMatch(
          matchId,
          request.body as Record<string, unknown>,
        );
        response.json({ ok: true, ...result });
      } catch (error) {
        response.status(400).json({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    async handleChatCallback(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      return handleChatCallback(request, response);
    },
    async handleLiveCallback(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      return handleLiveCallback(request, response);
    },
    async handleResultCallback(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      return handleResultCallback(request, response);
    },
    async handleStatsCallback(
      request: RawBodyRequest,
      response: express.Response,
    ) {
      return handleStatsCallback(request, response);
    },
  };
}
