import type {
  PickupMatchPlayerRow,
  PickupPlayerCard,
  PickupPlayerIdentity,
  PickupQueueMemberRow,
  PickupQueuePublicState,
  PickupQueueRow,
  PickupQueueSeasonState,
  PickupSeasonRow,
  PickupSettingsRow,
} from "./types.js";

export function toPlayerCard(player: PickupMatchPlayerRow): PickupPlayerCard {
  return {
    avatarUrl: player.avatarUrl,
    countryCode: player.countryCode,
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

export function toQueuedPlayerState(
  player: PickupQueueMemberRow,
): PickupPlayerIdentity & { joinedAt: string } {
  return {
    avatarUrl: player.avatarUrl,
    countryCode: player.countryCode,
    id: player.playerId,
    joinedAt: player.joinedAt.toISOString(),
    personaName: player.personaName,
    profileUrl: player.profileUrl,
    steamId: player.steamId,
  };
}

export function parseJson<T>(value: unknown): T | null {
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

export function seasonToState(
  season: PickupSeasonRow | null,
): PickupQueueSeasonState {
  return season
    ? {
        endsAt: season.endsAt.toISOString(),
        id: season.id,
        name: season.name,
        startsAt: season.startsAt.toISOString(),
        status: season.status,
      }
    : null;
}

export function queueToPublicState(
  queue: PickupQueueRow,
  settings: PickupSettingsRow,
  currentPlayers: number,
  season: PickupSeasonRow | null,
  members: PickupQueueMemberRow[],
): PickupQueuePublicState {
  return {
    currentPlayers,
    description: queue.description,
    enabled: queue.enabled,
    id: queue.id,
    name: queue.name,
    playerCount: queue.playerCount,
    players: members.map(toQueuedPlayerState),
    readyCheckDurationSeconds: settings.readyCheckDurationSeconds,
    season: seasonToState(season),
    slug: queue.slug,
    teamSize: queue.teamSize,
    vetoTurnDurationSeconds: settings.vetoTurnDurationSeconds,
  };
}
