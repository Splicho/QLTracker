import { activeRatingToState, ratingToState } from "./ratings.js";
import { toPlayerCard } from "./state.js";
import type {
  PickupActiveRatingRow,
  PickupMatchPlayerRow,
  PickupMatchRow,
  PickupMatchState,
  PickupPlayerIdentity,
  PickupPlayerLockRow,
  PickupPlayerLockState,
  PickupPlayerState,
  PickupPublicState,
  PickupRatingRow,
  PickupSeasonRow,
  PickupQueueRow,
} from "./types.js";

type PlayerStateDeps = {
  getActiveSeason: (queueId: string) => Promise<PickupSeasonRow | null>;
  getLatestPlayerActiveMatch: (playerId: string) => Promise<PickupMatchRow | null>;
  getLatestPlayerRecentCompletedMatch: (
    playerId: string,
  ) => Promise<PickupMatchRow | null>;
  getMatchPlayers: (matchId: string) => Promise<PickupMatchPlayerRow[]>;
  getOrCreatePlayerSeasonRating: (
    player: PickupPlayerIdentity,
    season: PickupSeasonRow,
  ) => Promise<PickupRatingRow>;
  getPlayerActiveRatings: (playerId: string) => Promise<PickupActiveRatingRow[]>;
  getActivePlayerLock: (playerId: string) => Promise<PickupPlayerLockRow | null>;
  getPlayerSeasonRating: (
    playerId: string,
    seasonId: string,
  ) => Promise<PickupRatingRow | null>;
  getPreferredPlayerRating: (playerId: string) => Promise<PickupRatingRow | null>;
  getPrimaryQueue: () => Promise<PickupQueueRow | null>;
  getPublicState: () => Promise<PickupPublicState>;
  getQueueMembership: (playerId: string) => Promise<
    | (PickupQueueRow & {
        joinedAt: Date;
      })
    | null
  >;
};

export function createPlayerStateApi(deps: PlayerStateDeps) {
  function lockToState(lock: PickupPlayerLockRow | null): PickupPlayerLockState | null {
    if (!lock) {
      return null;
    }

    return {
      expiresAt: lock.expiresAt?.toISOString() ?? null,
      id: lock.id,
      reason: lock.reason,
    };
  }

  async function buildMatchState(match: PickupMatchRow): Promise<PickupMatchState> {
    const matchPlayers = await deps.getMatchPlayers(match.id);
    const left = matchPlayers.filter((member) => member.team === "left");
    const right = matchPlayers.filter((member) => member.team === "right");

    return {
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
  }

  async function getPlayerState(
    player: PickupPlayerIdentity,
  ): Promise<PickupPlayerState> {
    const serverNow = new Date().toISOString();
    const [match, activeLock] = await Promise.all([
      deps.getLatestPlayerActiveMatch(player.id),
      deps.getActivePlayerLock(player.id),
    ]);
    const lockState = lockToState(activeLock);

    if (match) {
      const [publicState, rating, ratings] = await Promise.all([
        deps.getPublicState(),
        deps.getPlayerSeasonRating(player.id, match.seasonId),
        deps.getPlayerActiveRatings(player.id),
      ]);
      const matchState = await buildMatchState(match);

      return {
        activeLock: lockState,
        match: matchState,
        publicState,
        rating: ratingToState(rating),
        ratings: ratings.map(activeRatingToState),
        serverNow,
        stage: match.status as Exclude<PickupMatchRow["status"], "cancelled">,
        viewer: player,
      };
    }

    const [publicState, membership, primaryQueue, recentCompletedMatch] =
      await Promise.all([
        deps.getPublicState(),
        deps.getQueueMembership(player.id),
        deps.getPrimaryQueue(),
        deps.getLatestPlayerRecentCompletedMatch(player.id),
      ]);

    if (membership) {
      const season = await deps.getActiveSeason(membership.id);
      const rating =
        season != null
          ? await deps.getOrCreatePlayerSeasonRating(player, season)
          : null;
      const ratings = await deps.getPlayerActiveRatings(player.id);

      return {
        activeLock: lockState,
        publicState,
        queue: {
          joinedAt: membership.joinedAt.toISOString(),
          playerCount: membership.playerCount,
          queueId: membership.id,
          queueSlug: membership.slug,
        },
        rating: ratingToState(rating),
        ratings: ratings.map(activeRatingToState),
        serverNow,
        stage: "queue",
        viewer: player,
      };
    }

    if (recentCompletedMatch) {
      const [matchState, rating, ratings] = await Promise.all([
        buildMatchState(recentCompletedMatch),
        deps.getPlayerSeasonRating(player.id, recentCompletedMatch.seasonId),
        deps.getPlayerActiveRatings(player.id),
      ]);

      return {
        activeLock: lockState,
        match: matchState,
        publicState,
        rating: ratingToState(rating),
        ratings: ratings.map(activeRatingToState),
        serverNow,
        stage: "completed",
        viewer: player,
      };
    }

    if (!primaryQueue) {
      throw new Error("Pickup queue is unavailable.");
    }

    const season = await deps.getActiveSeason(primaryQueue.id);
    if (season != null) {
      await deps.getOrCreatePlayerSeasonRating(player, season);
    }
    const [rating, ratings] = await Promise.all([
      deps.getPreferredPlayerRating(player.id),
      deps.getPlayerActiveRatings(player.id),
    ]);

    return {
      activeLock: lockState,
      publicState,
      rating: ratingToState(rating),
      ratings: ratings.map(activeRatingToState),
      serverNow,
      stage: "idle",
      viewer: player,
    };
  }

  return {
    buildMatchState,
    getPlayerState,
  };
}
