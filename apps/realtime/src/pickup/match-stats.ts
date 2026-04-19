import {
  pickupStatsRelayPayloadSchema,
  type PickupStatsRelayEvent,
  type PickupStatsRelayPayload,
} from "@qltracker/contracts";
import type { PoolClient } from "pg";
import { pool } from "../db.js";
import type { PickupMatchPlayerRow } from "./types.js";

type MatchStatsEvent = PickupStatsRelayEvent;
type MatchStatsPayload = PickupStatsRelayPayload;

type MatchPlayerIndex = {
  bySteamId: Map<string, PickupMatchPlayerRow>;
};

const latchedMatchGuidByMatchId = new Map<string, string>();

function asObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickFirst<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value != null) {
      return value;
    }
  }

  return null;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function readBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

function parseEventAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeTeam(value: unknown): "left" | "right" | null {
  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "left", "red"].includes(normalized)) {
    return "left";
  }

  if (["2", "right", "blue"].includes(normalized)) {
    return "right";
  }

  return null;
}

function normalizeWinningTeam(value: unknown): "red" | "blue" | null {
  const normalized = readString(value)?.toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "left", "red"].includes(normalized)) {
    return "red";
  }

  if (["2", "right", "blue"].includes(normalized)) {
    return "blue";
  }

  return null;
}

function buildMatchPlayerIndex(players: PickupMatchPlayerRow[]): MatchPlayerIndex {
  return {
    bySteamId: new Map(
      players
        .map((player) => [player.steamId.trim(), player] as const)
        .filter((entry) => entry[0].length > 0),
    ),
  };
}

function resolvePlayer(
  index: MatchPlayerIndex,
  candidate: Record<string, unknown> | unknown,
) {
  const objectCandidate = asObject(candidate);
  const steamId = readString(
    pickFirst(
      objectCandidate?.STEAM_ID,
      objectCandidate?.steamId,
      objectCandidate?.steam_id,
      asObject(objectCandidate?.PLAYER)?.STEAM_ID,
      asObject(objectCandidate?.player)?.steamId,
      candidate,
    ),
  );

  if (!steamId) {
    return null;
  }

  return index.bySteamId.get(steamId) ?? null;
}

function parseWeaponEntries(rawWeapons: unknown) {
  const weaponEntries: Array<{
    accuracy: number | null;
    damage: number | null;
    deaths: number | null;
    hits: number | null;
    kills: number | null;
    raw: Record<string, unknown>;
    shots: number | null;
    timeSeconds: number | null;
    weapon: string;
  }> = [];

  const asWeaponEntry = (weapon: string, raw: Record<string, unknown>) => {
    weaponEntries.push({
      accuracy: readNumber(
        pickFirst(raw.ACCURACY, raw.accuracy, raw.AC, raw.accuracy_pct),
      ),
      damage: readNumber(pickFirst(raw.DAMAGE, raw.damage, raw.DG, raw.DMG)),
      deaths: readNumber(pickFirst(raw.DEATHS, raw.deaths, raw.D)),
      hits: readNumber(pickFirst(raw.HITS, raw.hits, raw.H)),
      kills: readNumber(pickFirst(raw.KILLS, raw.kills, raw.K)),
      raw,
      shots: readNumber(
        pickFirst(
          raw.SHOTS,
          raw.shots,
          raw.ATTACKS,
          raw.attacks,
          raw.fired,
          raw.S,
        ),
      ),
      timeSeconds: readNumber(
        pickFirst(raw.TIME, raw.time, raw.timeSeconds, raw.T),
      ),
      weapon,
    });
  };

  const weaponsObject = asObject(rawWeapons);
  if (weaponsObject) {
    for (const [weaponName, value] of Object.entries(weaponsObject)) {
      const entry = asObject(value);
      if (!entry) {
        continue;
      }

      asWeaponEntry(weaponName, entry);
    }
  }

  for (const value of asArray(rawWeapons)) {
    const entry = asObject(value);
    const weapon = readString(
      pickFirst(entry?.WEAPON, entry?.weapon, entry?.NAME, entry?.name),
    );
    if (!entry || !weapon) {
      continue;
    }

    asWeaponEntry(weapon, entry);
  }

  return weaponEntries;
}

function parsePlayerStatsEvent(
  index: MatchPlayerIndex,
  event: MatchStatsEvent,
) {
  const player = resolvePlayer(index, event.data);
  if (!player) {
    return null;
  }

  const weapons = parseWeaponEntries(
    pickFirst(
      event.data.WEAPONS,
      event.data.weapons,
      event.data.WEAPON_STATS,
      event.data.weaponStats,
    ),
  );

  return {
    player,
    stats: {
      accuracy: readNumber(pickFirst(event.data.ACCURACY, event.data.accuracy)),
      damageGiven: readNumber(
        pickFirst(
          event.data.DAMAGE_DEALT,
          event.data.damageDealt,
          event.data.DMG_GIVEN,
          event.data.damageGiven,
          event.data.DG,
        ),
      ),
      damageTaken: readNumber(
        pickFirst(
          event.data.DAMAGE_TAKEN,
          event.data.damageTaken,
          event.data.DMG_TAKEN,
          event.data.DR,
        ),
      ),
      deaths: readNumber(pickFirst(event.data.DEATHS, event.data.deaths, event.data.D)),
      kills: readNumber(pickFirst(event.data.KILLS, event.data.kills, event.data.K)),
      medals: asObject(pickFirst(event.data.MEDALS, event.data.medals)),
      ping: readNumber(pickFirst(event.data.PING, event.data.ping)),
      raw: event.data,
      score: readNumber(pickFirst(event.data.SCORE, event.data.score)),
      team: normalizeTeam(pickFirst(event.data.TEAM, event.data.team, player.team)),
      timeSeconds: readNumber(
        pickFirst(event.data.TIME, event.data.time, event.data.timeSeconds),
      ),
      weapons,
    },
  };
}

function hasNonZeroNumber(...values: Array<number | null>) {
  return values.some((value) => typeof value === "number" && value !== 0);
}

function hasMeaningfulWeaponStats(
  weapon: ReturnType<typeof parseWeaponEntries>[number],
) {
  return hasNonZeroNumber(
    weapon.accuracy,
    weapon.damage,
    weapon.deaths,
    weapon.hits,
    weapon.kills,
    weapon.shots,
    weapon.timeSeconds,
  );
}

function hasMeaningfulPlayerStats(
  stats: NonNullable<ReturnType<typeof parsePlayerStatsEvent>>["stats"],
) {
  return (
    hasNonZeroNumber(
      stats.accuracy,
      stats.damageGiven,
      stats.damageTaken,
      stats.deaths,
      stats.kills,
      stats.score,
      stats.timeSeconds,
    ) || stats.weapons.some(hasMeaningfulWeaponStats)
  );
}

function parseKillEvent(index: MatchPlayerIndex, event: MatchStatsEvent) {
  const killerSource =
    asObject(pickFirst(event.data.KILLER, event.data.killer, event.data.ATTACKER)) ??
    asObject(event.data);
  const victimSource =
    asObject(pickFirst(event.data.VICTIM, event.data.victim, event.data.TARGET)) ??
    asObject(event.data);

  const killer = resolvePlayer(index, killerSource);
  const victim = resolvePlayer(index, victimSource);

  const killerSteamId =
    killer?.steamId ??
    readString(
      pickFirst(
        killerSource?.STEAM_ID,
        killerSource?.steamId,
        killerSource?.steam_id,
      ),
    );
  const victimSteamId =
    victim?.steamId ??
    readString(
      pickFirst(
        victimSource?.STEAM_ID,
        victimSource?.steamId,
        victimSource?.steam_id,
      ),
    );

  const killerName =
    killer?.personaName ??
    readString(pickFirst(killerSource?.NAME, killerSource?.name));
  const victimName =
    victim?.personaName ??
    readString(pickFirst(victimSource?.NAME, victimSource?.name));

  const teamKill =
    readBoolean(pickFirst(event.data.TEAMKILL, event.data.teamkill)) ?? false;
  const suicide =
    readBoolean(pickFirst(event.data.SUICIDE, event.data.suicide)) ??
    Boolean(killerSteamId && victimSteamId && killerSteamId === victimSteamId);

  return {
    killerName,
    killerPlayerId: killer?.playerId ?? null,
    killerSteamId: killerSteamId ?? null,
    mod: readString(pickFirst(event.data.MOD, event.data.mod, event.data.KILL_MOD)),
    occurredAt: parseEventAt(event.eventAt),
    raw: event.data,
    suicide,
    teamKill,
    victimName,
    victimPlayerId: victim?.playerId ?? null,
    victimSteamId: victimSteamId ?? null,
    weapon: readString(
      pickFirst(event.data.WEAPON, event.data.weapon, event.data.MOD, event.data.mod),
    ),
  };
}

function getKillEventActorSignature(source: Record<string, unknown> | null) {
  return (
    readString(
      pickFirst(source?.STEAM_ID, source?.steamId, source?.steam_id),
    ) ??
    readString(pickFirst(source?.NAME, source?.name)) ??
    ""
  )
    .trim()
    .toLowerCase();
}

function getKillEventSignature(event: MatchStatsEvent) {
  const killerSource =
    asObject(pickFirst(event.data.KILLER, event.data.killer, event.data.ATTACKER)) ??
    asObject(event.data);
  const victimSource =
    asObject(pickFirst(event.data.VICTIM, event.data.victim, event.data.TARGET)) ??
    asObject(event.data);
  const matchGuid =
    readString(pickFirst(event.data.MATCH_GUID, event.data.matchGuid)) ?? "";
  const round = readNumber(pickFirst(event.data.ROUND, event.data.round)) ?? "";
  const time = readNumber(pickFirst(event.data.TIME, event.data.time)) ?? "";
  const weapon =
    readString(
      pickFirst(event.data.MOD, event.data.mod, event.data.WEAPON, event.data.weapon),
    ) ?? "";
  const teamKill =
    readBoolean(pickFirst(event.data.TEAMKILL, event.data.teamkill)) ?? false;
  const suicide =
    readBoolean(pickFirst(event.data.SUICIDE, event.data.suicide)) ?? false;

  return [
    matchGuid.trim().toLowerCase(),
    round,
    time,
    getKillEventActorSignature(killerSource),
    getKillEventActorSignature(victimSource),
    weapon.trim().toLowerCase(),
    teamKill ? "tk" : "",
    suicide ? "suicide" : "",
  ].join("|");
}

function parseSummaryUpdate(event: MatchStatsEvent) {
  const data = event.data;
  const teamWon = normalizeWinningTeam(
    pickFirst(data.TEAM_WON, data.teamWon, data.WINNER, data.winner),
  );

  return {
    blueRounds: readNumber(
      pickFirst(data.TSCORE1, data.BLUE_SCORE, data.blueScore),
    ),
    endedAt: ["MATCH_REPORT", "QLTRACKER_SUPPLEMENTAL_END"].includes(event.type)
      ? parseEventAt(event.eventAt)
      : null,
    factory: readString(
      pickFirst(data.FACTORY, data.factory, data.GAMETYPE, data.gameType),
    ),
    gameType: readString(
      pickFirst(data.GAMETYPE, data.gameType, data.GAME_TYPE, data.game_type),
    ),
    mapKey: readString(pickFirst(data.MAP, data.map, data.MAPNAME, data.mapName)),
    matchDurationSeconds: readNumber(
      pickFirst(data.MATCH_TIME, data.matchTime, data.DURATION, data.duration),
    ),
    raw: data,
    redRounds: readNumber(pickFirst(data.TSCORE0, data.RED_SCORE, data.redScore)),
    roundsPlayed: readNumber(
      pickFirst(data.ROUND, data.round, data.ROUNDS, data.roundsPlayed),
    ),
    startedAt: ["MATCH_STARTED", "QLTRACKER_SUPPLEMENTAL_START"].includes(event.type)
      ? parseEventAt(event.eventAt)
      : null,
    teamWon,
  };
}

function isMatchGuidLockedEventType(eventType: string) {
  return eventType === "PLAYER_STATS" || eventType === "MATCH_REPORT";
}

function readEventMatchGuid(event: MatchStatsEvent) {
  return readString(
    pickFirst(
      event.data.MATCH_GUID,
      event.data.matchGuid,
      event.data.match_guid,
    ),
  );
}

function isQuitPlayerStatsEvent(event: MatchStatsEvent) {
  return (
    event.type === "PLAYER_STATS" &&
    (readBoolean(pickFirst(event.data.QUIT, event.data.quit)) ?? false)
  );
}

async function insertRawEvent(
  client: PoolClient,
  matchId: string,
  event: MatchStatsEvent,
) {
  await client.query(
    `
      insert into "PickupMatchEventRaw" (
        "id",
        "matchId",
        "eventIndex",
        "source",
        "eventType",
        "eventAt",
        "payload",
        "createdAt"
      )
      values (
        gen_random_uuid()::text,
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        now()
      )
      on conflict ("matchId", "eventIndex") do nothing
    `,
    [
      matchId,
      event.eventIndex,
      event.source,
      event.type,
      parseEventAt(event.eventAt),
      JSON.stringify(event.data),
    ],
  );
}

async function upsertStatsSummary(
  client: PoolClient,
  matchId: string,
  event: MatchStatsEvent,
) {
  const summary = parseSummaryUpdate(event);
  const previousResult = await client.query<{
    blueRounds: number | null;
    redRounds: number | null;
    sourceEventIndex: number | null;
  }>(
    `
      select "blueRounds", "redRounds", "sourceEventIndex"
      from "PickupMatchStatsSummary"
      where "matchId" = $1
      limit 1
    `,
    [matchId],
  );
  const previous = previousResult.rows[0] ?? null;
  const shouldDeriveRoundScore =
    event.type === "ROUND_OVER" &&
    summary.redRounds == null &&
    summary.blueRounds == null &&
    summary.teamWon != null &&
    (previous?.sourceEventIndex == null ||
      event.eventIndex > previous.sourceEventIndex);
  const redRounds = shouldDeriveRoundScore
    ? (previous?.redRounds ?? 0) + (summary.teamWon === "red" ? 1 : 0)
    : summary.redRounds;
  const blueRounds = shouldDeriveRoundScore
    ? (previous?.blueRounds ?? 0) + (summary.teamWon === "blue" ? 1 : 0)
    : summary.blueRounds;

  await client.query(
    `
      insert into "PickupMatchStatsSummary" (
        "matchId",
        "sourceEventIndex",
        "gameType",
        "factory",
        "mapKey",
        "roundsPlayed",
        "redRounds",
        "blueRounds",
        "matchDurationSeconds",
        "startedAt",
        "endedAt",
        "raw",
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
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::jsonb,
        now(),
        now()
      )
      on conflict ("matchId") do update
      set
        "sourceEventIndex" = greatest(coalesce("PickupMatchStatsSummary"."sourceEventIndex", 0), excluded."sourceEventIndex"),
        "gameType" = coalesce(excluded."gameType", "PickupMatchStatsSummary"."gameType"),
        "factory" = coalesce(excluded."factory", "PickupMatchStatsSummary"."factory"),
        "mapKey" = coalesce(excluded."mapKey", "PickupMatchStatsSummary"."mapKey"),
        "roundsPlayed" = coalesce(excluded."roundsPlayed", "PickupMatchStatsSummary"."roundsPlayed"),
        "redRounds" = coalesce(excluded."redRounds", "PickupMatchStatsSummary"."redRounds"),
        "blueRounds" = coalesce(excluded."blueRounds", "PickupMatchStatsSummary"."blueRounds"),
        "matchDurationSeconds" = coalesce(excluded."matchDurationSeconds", "PickupMatchStatsSummary"."matchDurationSeconds"),
        "startedAt" = coalesce("PickupMatchStatsSummary"."startedAt", excluded."startedAt"),
        "endedAt" = coalesce(excluded."endedAt", "PickupMatchStatsSummary"."endedAt"),
        "raw" = excluded."raw",
        "updatedAt" = now()
    `,
    [
      matchId,
      event.eventIndex,
      summary.gameType,
      summary.factory,
      summary.mapKey,
      summary.roundsPlayed,
      redRounds,
      blueRounds,
      summary.matchDurationSeconds,
      summary.startedAt,
      summary.endedAt,
      JSON.stringify(summary.raw),
    ],
  );
}

async function upsertPlayerStats(
  client: PoolClient,
  matchId: string,
  event: MatchStatsEvent,
  index: MatchPlayerIndex,
) {
  const parsed = parsePlayerStatsEvent(index, event);
  if (!parsed) {
    return;
  }

  if (!hasMeaningfulPlayerStats(parsed.stats)) {
    return;
  }

  await client.query(
    `
      insert into "PickupPlayerMatchStat" (
        "id",
        "matchId",
        "playerId",
        "team",
        "score",
        "kills",
        "deaths",
        "damageGiven",
        "damageTaken",
        "timeSeconds",
        "ping",
        "accuracy",
        "medals",
        "raw",
        "createdAt",
        "updatedAt"
      )
      values (
        gen_random_uuid()::text,
        $1,
        $2,
        $3::"PickupTeamSide",
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12::jsonb,
        $13::jsonb,
        now(),
        now()
      )
      on conflict ("matchId", "playerId") do update
      set
        "team" = coalesce(excluded."team", "PickupPlayerMatchStat"."team"),
        "score" = coalesce(excluded."score", "PickupPlayerMatchStat"."score"),
        "kills" = coalesce(excluded."kills", "PickupPlayerMatchStat"."kills"),
        "deaths" = coalesce(excluded."deaths", "PickupPlayerMatchStat"."deaths"),
        "damageGiven" = coalesce(excluded."damageGiven", "PickupPlayerMatchStat"."damageGiven"),
        "damageTaken" = coalesce(excluded."damageTaken", "PickupPlayerMatchStat"."damageTaken"),
        "timeSeconds" = coalesce(excluded."timeSeconds", "PickupPlayerMatchStat"."timeSeconds"),
        "ping" = coalesce(excluded."ping", "PickupPlayerMatchStat"."ping"),
        "accuracy" = coalesce(excluded."accuracy", "PickupPlayerMatchStat"."accuracy"),
        "medals" = coalesce(excluded."medals", "PickupPlayerMatchStat"."medals"),
        "raw" = excluded."raw",
        "updatedAt" = now()
    `,
    [
      matchId,
      parsed.player.playerId,
      parsed.stats.team,
      parsed.stats.score,
      parsed.stats.kills,
      parsed.stats.deaths,
      parsed.stats.damageGiven,
      parsed.stats.damageTaken,
      parsed.stats.timeSeconds,
      parsed.stats.ping,
      parsed.stats.accuracy,
      parsed.stats.medals ? JSON.stringify(parsed.stats.medals) : null,
      JSON.stringify(parsed.stats.raw),
    ],
  );

  for (const weapon of parsed.stats.weapons.filter(hasMeaningfulWeaponStats)) {
    await client.query(
      `
        insert into "PickupPlayerWeaponStat" (
          "id",
          "matchId",
          "playerId",
          "weapon",
          "shots",
          "hits",
          "accuracy",
          "kills",
          "deaths",
          "damage",
          "timeSeconds",
          "raw",
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
          $8,
          $9,
          $10,
          $11::jsonb,
          now(),
          now()
        )
        on conflict ("matchId", "playerId", "weapon") do update
        set
          "shots" = coalesce(excluded."shots", "PickupPlayerWeaponStat"."shots"),
          "hits" = coalesce(excluded."hits", "PickupPlayerWeaponStat"."hits"),
          "accuracy" = coalesce(excluded."accuracy", "PickupPlayerWeaponStat"."accuracy"),
          "kills" = coalesce(excluded."kills", "PickupPlayerWeaponStat"."kills"),
          "deaths" = coalesce(excluded."deaths", "PickupPlayerWeaponStat"."deaths"),
          "damage" = coalesce(excluded."damage", "PickupPlayerWeaponStat"."damage"),
          "timeSeconds" = coalesce(excluded."timeSeconds", "PickupPlayerWeaponStat"."timeSeconds"),
          "raw" = excluded."raw",
          "updatedAt" = now()
      `,
      [
        matchId,
        parsed.player.playerId,
        weapon.weapon,
        weapon.shots,
        weapon.hits,
        weapon.accuracy,
        weapon.kills,
        weapon.deaths,
        weapon.damage,
        weapon.timeSeconds,
        JSON.stringify(weapon.raw),
      ],
    );
  }
}

async function insertKillEvent(
  client: PoolClient,
  matchId: string,
  event: MatchStatsEvent,
  index: MatchPlayerIndex,
) {
  const kill = parseKillEvent(index, event);
  if (!kill.killerPlayerId && !kill.victimPlayerId && !kill.killerSteamId && !kill.victimSteamId) {
    return;
  }

  await client.query(
    `
      insert into "PickupKillEvent" (
        "id",
        "matchId",
        "eventIndex",
        "killerPlayerId",
        "killerSteamId",
        "killerName",
        "victimPlayerId",
        "victimSteamId",
        "victimName",
        "weapon",
        "mod",
        "teamKill",
        "suicide",
        "occurredAt",
        "raw",
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
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14::jsonb,
        now()
      )
      on conflict ("matchId", "eventIndex") do update
      set
        "killerPlayerId" = coalesce(excluded."killerPlayerId", "PickupKillEvent"."killerPlayerId"),
        "killerSteamId" = coalesce(excluded."killerSteamId", "PickupKillEvent"."killerSteamId"),
        "killerName" = coalesce(excluded."killerName", "PickupKillEvent"."killerName"),
        "victimPlayerId" = coalesce(excluded."victimPlayerId", "PickupKillEvent"."victimPlayerId"),
        "victimSteamId" = coalesce(excluded."victimSteamId", "PickupKillEvent"."victimSteamId"),
        "victimName" = coalesce(excluded."victimName", "PickupKillEvent"."victimName"),
        "weapon" = coalesce(excluded."weapon", "PickupKillEvent"."weapon"),
        "mod" = coalesce(excluded."mod", "PickupKillEvent"."mod"),
        "teamKill" = excluded."teamKill",
        "suicide" = excluded."suicide",
        "occurredAt" = coalesce(excluded."occurredAt", "PickupKillEvent"."occurredAt"),
        "raw" = excluded."raw"
    `,
    [
      matchId,
      event.eventIndex,
      kill.killerPlayerId,
      kill.killerSteamId,
      kill.killerName,
      kill.victimPlayerId,
      kill.victimSteamId,
      kill.victimName,
      kill.weapon,
      kill.mod,
      kill.teamKill,
      kill.suicide,
      kill.occurredAt,
      JSON.stringify(kill.raw),
    ],
  );
}

function parsePayload(payload: Record<string, unknown>): MatchStatsPayload {
  return pickupStatsRelayPayloadSchema.parse(payload);
}

export async function applyPickupMatchStats(
  matchId: string,
  payload: Record<string, unknown>,
  getMatchPlayers: (matchId: string) => Promise<PickupMatchPlayerRow[]>,
) {
  const parsed = parsePayload(payload);
  if (parsed.matchId !== matchId) {
    throw new Error("Stats callback matchId does not match payload.");
  }

  const players = await getMatchPlayers(matchId);
  const index = buildMatchPlayerIndex(players);
  const playerKillSignatures = new Set(
    parsed.events
      .filter((event) => event.type === "PLAYER_KILL")
      .map(getKillEventSignature),
  );

  const client = await pool.connect();
  try {
    await client.query("begin");
    let latchedMatchGuid = latchedMatchGuidByMatchId.get(matchId) ?? null;

    for (const event of parsed.events) {
      if (isMatchGuidLockedEventType(event.type)) {
        const eventMatchGuid = readEventMatchGuid(event);
        if (latchedMatchGuid) {
          if (eventMatchGuid !== latchedMatchGuid) {
            continue;
          }
        } else if (eventMatchGuid) {
          latchedMatchGuid = eventMatchGuid;
          latchedMatchGuidByMatchId.set(matchId, eventMatchGuid);
        }
      }

      await insertRawEvent(client, matchId, event);

      if (
        [
          "MATCH_STARTED",
          "ROUND_OVER",
          "MATCH_REPORT",
          "QLTRACKER_SUPPLEMENTAL_START",
          "QLTRACKER_SUPPLEMENTAL_END",
        ].includes(event.type)
      ) {
        await upsertStatsSummary(client, matchId, event);
      }

      if (event.type === "PLAYER_STATS" && !isQuitPlayerStatsEvent(event)) {
        await upsertPlayerStats(client, matchId, event, index);
      }

      if (
        event.type === "PLAYER_KILL" ||
        (event.type === "PLAYER_DEATH" &&
          !playerKillSignatures.has(getKillEventSignature(event)))
      ) {
        await insertKillEvent(client, matchId, event, index);
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
