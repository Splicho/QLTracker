import crypto from "node:crypto";
import type express from "express";
import type { Server, Socket } from "socket.io";
import { Rating, TrueSkill } from "ts-trueskill";
import { config } from "./config.js";
import { pool } from "./db.js";
import { lookupCountry } from "./geolite.js";
import { createPickupCallbackApi } from "./pickup/callbacks.js";
import { applyPickupMatchStats } from "./pickup/match-stats.js";
import { defaultDisplayRating } from "./pickup/ratings.js";
import { chooseBalancedTeams } from "./pickup/matchmaking.js";
import { createPlayerStateApi } from "./pickup/player-state.js";
import { parseJson, queueToPublicState } from "./pickup/state.js";
import type {
  PickupActiveRatingRow,
  PickupBalanceSummary,
  PickupMatchPlayerRow,
  PickupMatchRow,
  PickupPlayerIdentity,
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
  readyCheckDurationSeconds: 30,
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
const COMPLETED_MATCH_VISIBLE_MS = 30_000;
const PROVISION_RETRY_DELAYS_MS = [0, 5_000, 10_000, 20_000, 30_000] as const;
const PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER = "x-qltracker-signature";

type PickupQueueOpenedAlertPayload = {
  action: "joined" | "opened";
  currentPlayers: number;
  joinedAt: string;
  player: {
    avatarUrl: string | null;
    id: string;
    personaName: string;
    profileUrl: string | null;
    steamId: string;
  };
  queue: {
    id: string;
    name: string;
    playerCount: number;
    slug: string;
    teamSize: number;
  };
  type: "pickup.queue_opened";
};

function hashPickupToken(token: string) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`pickup:${token}`)
    .digest("hex");
}

function createSignature(secret: string, body: string) {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function stripQuakeColors(value: string) {
  return value.replace(/\^\^/g, "\0").replace(/\^\d/g, "").replace(/\0/g, "^").trim();
}

function createRating(mu: number, sigma: number) {
  return ratingEnv.createRating(mu, sigma);
}

const DEFAULT_PICKUP_DISPLAY_RATING = 1000;

export function createPickupService(io: Server) {
  const readyTimers = new Map<string, NodeJS.Timeout>();
  const vetoTimers = new Map<string, NodeJS.Timeout>();
  const queueDisconnectTimers = new Map<string, NodeJS.Timeout>();
  const connectedPickupSocketsByPlayerId = new Map<string, Set<string>>();

  async function notifyQueueOpened(
    payload: PickupQueueOpenedAlertPayload,
  ): Promise<void> {
    if (!config.pickupQueueAlertsWebhookUrl || !config.pickupQueueAlertsWebhookSecret) {
      console.info("Skipping pickup queue alert webhook because it is not configured.", {
        hasWebhookSecret: Boolean(config.pickupQueueAlertsWebhookSecret),
        hasWebhookUrl: Boolean(config.pickupQueueAlertsWebhookUrl),
        queueSlug: payload.queue.slug,
      });
      return;
    }

    const body = JSON.stringify(payload);
    const signature = createSignature(config.pickupQueueAlertsWebhookSecret, body);

    console.info("Sending pickup queue alert webhook.", {
      currentPlayers: payload.currentPlayers,
      playerId: payload.player.id,
      playerName: payload.player.personaName,
      queueId: payload.queue.id,
      queueSlug: payload.queue.slug,
      url: config.pickupQueueAlertsWebhookUrl,
    });

    try {
      const response = await fetch(config.pickupQueueAlertsWebhookUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER]: signature,
        },
        body,
      });

      if (!response.ok) {
        console.warn("Failed to deliver pickup queue alert webhook.", {
          queueSlug: payload.queue.slug,
          status: response.status,
          statusText: response.statusText,
          url: config.pickupQueueAlertsWebhookUrl,
        });
        return;
      }

      console.info("Delivered pickup queue alert webhook.", {
        queueSlug: payload.queue.slug,
        status: response.status,
        url: config.pickupQueueAlertsWebhookUrl,
      });
    } catch (error) {
      console.warn("Failed to deliver pickup queue alert webhook.", {
        error,
        queueSlug: payload.queue.slug,
        url: config.pickupQueueAlertsWebhookUrl,
      });
    }
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
      if (left.slug === DEFAULT_QUEUE.slug && right.slug !== DEFAULT_QUEUE.slug) {
        return -1;
      }

      if (right.slug === DEFAULT_QUEUE.slug && left.slug !== DEFAULT_QUEUE.slug) {
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
    const rating = existing.rows[0];
    if (
      rating.gamesPlayed === 0 &&
      (rating.displayRating !== DEFAULT_PICKUP_DISPLAY_RATING ||
        rating.mu !== ratingEnv.mu ||
        rating.sigma !== ratingEnv.sigma)
    ) {
      const normalized = await pool.query<PickupRatingRow>(
        `
          update "PickupPlayerSeasonRating"
          set
            "mu" = $3,
            "sigma" = $4,
            "displayRating" = $5,
            "seededFrom" = 'default-baseline',
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
        [season.id, player.id, ratingEnv.mu, ratingEnv.sigma, DEFAULT_PICKUP_DISPLAY_RATING],
      );

      return normalized.rows[0] ?? rating;
    }

    return rating;
  }

  const mu = ratingEnv.mu;
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
        DEFAULT_PICKUP_DISPLAY_RATING,
        "default-baseline",
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
          r."losses"
        from "PickupPlayerSeasonRating" r
        inner join "PickupSeason" s
          on s."id" = r."seasonId"
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
          q."name" as "queueName"
        from "PickupPlayerSeasonRating" r
        inner join "PickupSeason" s
          on s."id" = r."seasonId"
        inner join "PickupQueue" q
          on q."id" = s."queueId"
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
        where qm."playerId" = $1
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
          select "queueId", count(*)::text as count
          from "PickupQueueMember"
          group by "queueId"
        `,
      ),
      Promise.all(queues.map((queue) => getActiveSeason(queue.id))),
      Promise.all(queues.map((queue) => getQueueMembers(queue.id, queue.playerCount))),
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
      provisionPayload: parseJson<Record<string, unknown>>(row.provisionPayload),
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
            or (m."status" = 'veto' and m."vetoDeadlineAt" > now())
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
      provisionPayload: parseJson<Record<string, unknown>>(row.provisionPayload),
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
      provisionPayload: parseJson<Record<string, unknown>>(row.provisionPayload),
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

  const playerStateApi = createPlayerStateApi({
    getActiveSeason,
    getLatestPlayerActiveMatch,
    getLatestPlayerRecentCompletedMatch,
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
    io.emit("pickup:queues:update", publicState.queues);
    io.emit("pickup:queue:update", publicState.queue);
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
    const sockets = connectedPickupSocketsByPlayerId.get(playerId) ?? new Set<string>();
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
    const settings = await getPickupSettings();
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
            countryCode: member.countryCode,
            id: member.playerId,
            personaName: member.personaName,
            profileUrl: member.profileUrl,
            steamId: member.steamId,
          },
          season,
        ),
      })),
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

      const lockedIds = lockedMembers.rows.map((member) => member.queueMemberId);
      const deletedMembers = await client.query<{ queueMemberId: string }>(
        `
          delete from "PickupQueueMember"
          where "id" = any($1::text[])
          returning "id" as "queueMemberId"
        `,
        [lockedIds],
      );
      if (deletedMembers.rows.length !== lockedIds.length) {
        throw new Error("Pickup queue members could not be claimed atomically.");
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
      captainIds[Math.floor(Math.random() * captainIds.length)] ?? captainIds[0]!;
    const vetoDeadlineAt = new Date(
      Date.now() + settings.vetoTurnDurationSeconds * 1000,
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
      typeof payload.joinAddress === "string" && payload.joinAddress.trim().length > 0
        ? payload.joinAddress.trim()
        : `${ip}:${port}`;

    await pool.query(
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
        where "id" = $1
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

    const failProvision = async (reason: string, payload?: Record<string, unknown>) => {
      const players = await getMatchPlayers(matchId);
      const requeuedPlayerIds = players.map((player) => player.playerId);
      await requeueReadyPlayers(match.queueId, players);
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
            ...(payload ?? {}),
            reason,
            requeuedPlayerIds,
          }),
        ],
      );

      await recordProvisionEvent(matchId, "provision-failed", {
        ...(payload ?? {}),
        reason,
        requeuedPlayerIds,
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
          parsed = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : null;
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
    const settings = await getPickupSettings();
    const vetoDeadlineAt = new Date(
      Date.now() + settings.vetoTurnDurationSeconds * 1000,
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

    const [activeMatch, membership] = await Promise.all([
      getLatestPlayerActiveMatch(session.player.id),
      getQueueMembership(session.player.id),
    ]);
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

      console.info("Triggering pickup queue alert webhook after successful join.", {
        action,
        currentPlayers,
        playerId: session.player.id,
        queueId: queue.id,
        queueSlug: queue.slug,
      });

      void notifyQueueOpened({
        action,
        currentPlayers,
        joinedAt: new Date().toISOString(),
        player: {
          avatarUrl: session.player.avatarUrl,
          id: session.player.id,
          personaName: stripQuakeColors(session.player.personaName),
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
    } else {
      console.info("Skipping pickup queue alert webhook after join.", {
        inserted: Boolean(insertResult.rowCount),
        playerId: session.player.id,
        queueCountBeforeJoin,
        queueId: queue.id,
        queueSlug: queue.slug,
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
        console.error("Failed to auto-leave disconnected pickup player:", error);
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
    const match = await getLatestMatchById(matchId);
    if (!match || match.status === "completed" || match.status === "cancelled") {
      return;
    }

    if (!["server_ready", "live"].includes(match.status)) {
      throw new Error("Pickup match server is not ready yet.");
    }

    await pool.query(
      `
        update "PickupMatch"
        set
          "status" = 'live',
          "liveStartedAt" = coalesce("liveStartedAt", now()),
          "updatedAt" = now()
        where "id" = $1
      `,
      [matchId],
    );

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
            player.matchPlayerId,
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
            player.matchPlayerId,
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

  async function applyMatchStats(
    matchId: string,
    payload: Record<string, unknown>,
  ) {
    const match = await getLatestMatchById(matchId);
    if (!match || match.status === "cancelled") {
      return;
    }

    await applyPickupMatchStats(matchId, payload, getMatchPlayers);
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
  const callbackApi = createPickupCallbackApi({
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
    getPlayerStateByToken,
    handleLiveCallback,
    handleProvisionCallback,
    handleResultCallback,
    handleStatsCallback,
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
    },
    async handleProvisionCallback(request: RawBodyRequest, response: express.Response) {
      return handleProvisionCallback(request, response);
    },
    async handleLiveCallback(request: RawBodyRequest, response: express.Response) {
      return handleLiveCallback(request, response);
    },
    async handleResultCallback(request: RawBodyRequest, response: express.Response) {
      return handleResultCallback(request, response);
    },
    async handleStatsCallback(request: RawBodyRequest, response: express.Response) {
      return handleStatsCallback(request, response);
    },
  };
}
