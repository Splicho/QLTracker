import { activeRatingToState, ratingToState } from "./ratings.js";
import { toPlayerCard } from "./state.js";
import type {
  PickupActiveRatingRow,
  PickupMatchPlayerRow,
  PickupMatchSubRequestRow,
  PickupMatchRow,
  PickupMatchState,
  PickupPlayerIdentity,
  PickupPlayerLockRow,
  PickupPlayerLockState,
  PickupSubRequestParticipantState,
  PickupSubRequestState,
  PickupPlayerState,
  PickupPublicState,
  PickupRatingRow,
  PickupSeasonRow,
  PickupQueueRow,
} from "./types.js";

type PlayerStateDeps = {
  ensureReadyCheckPlayerDeadline: (
    matchId: string,
    playerId: string,
  ) => Promise<Date | null>;
  getActiveSeason: (queueId: string) => Promise<PickupSeasonRow | null>;
  getLatestPlayerActiveMatch: (playerId: string) => Promise<PickupMatchRow | null>;
  getLatestPlayerRecentCompletedMatch: (
    playerId: string,
  ) => Promise<PickupMatchRow | null>;
  getPendingMatchSubRequest: (
    matchId: string,
  ) => Promise<PickupMatchSubRequestRow | null>;
  getPendingSubRequestForRequester: (
    playerId: string,
  ) => Promise<PickupMatchSubRequestRow | null>;
  getPendingSubRequestForTarget: (
    playerId: string,
  ) => Promise<PickupMatchSubRequestRow | null>;
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

  function toSubRequestParticipantState(
    participant: {
      avatarUrl: string | null;
      countryCode: string | null;
      id: string;
      personaName: string;
      profileUrl: string | null;
      steamId: string;
    },
  ): PickupSubRequestParticipantState {
    return {
      avatarUrl: participant.avatarUrl,
      countryCode: participant.countryCode,
      id: participant.id,
      personaName: participant.personaName,
      profileUrl: participant.profileUrl,
      steamId: participant.steamId,
    };
  }

  function toSubRequestState(
    request: PickupMatchSubRequestRow | null,
  ): PickupSubRequestState | null {
    if (!request) {
      return null;
    }

    return {
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
      finalMapKey: request.finalMapKey,
      id: request.id,
      matchId: request.matchId,
      queueId: request.queueId,
      queueName: request.queueName,
      queueSlug: request.queueSlug,
      requester: toSubRequestParticipantState({
        avatarUrl: request.requesterAvatarUrl,
        countryCode: request.requesterCountryCode,
        id: request.requesterPlayerId,
        personaName: request.requesterPersonaName,
        profileUrl: request.requesterProfileUrl,
        steamId: request.requesterSteamId,
      }),
      stage: request.stage,
      status: request.status,
      target: toSubRequestParticipantState({
        avatarUrl: request.targetAvatarUrl,
        countryCode: request.targetCountryCode,
        id: request.targetPlayerId,
        personaName: request.targetPersonaName,
        profileUrl: request.targetProfileUrl,
        steamId: request.targetSteamId,
      }),
    };
  }

  async function buildMatchState(
    match: PickupMatchRow,
    readyDeadlineAtOverride?: Date | null,
  ): Promise<PickupMatchState> {
    const [matchPlayers, pendingSubRequest] = await Promise.all([
      deps.getMatchPlayers(match.id),
      deps.getPendingMatchSubRequest(match.id),
    ]);
    const left = matchPlayers.filter((member) => member.team === "left");
    const right = matchPlayers.filter((member) => member.team === "right");

    return {
      balanceSummary: match.balanceSummary,
      completedAt: match.completedAt?.toISOString() ?? null,
      finalMapKey: match.finalMapKey,
      finalScore: match.finalScore,
      id: match.id,
      liveStartedAt: match.liveStartedAt?.toISOString() ?? null,
      pendingSubRequest: pendingSubRequest
        ? {
            createdAt: pendingSubRequest.createdAt.toISOString(),
            expiresAt: pendingSubRequest.expiresAt.toISOString(),
            id: pendingSubRequest.id,
            requester: toSubRequestParticipantState({
              avatarUrl: pendingSubRequest.requesterAvatarUrl,
              countryCode: pendingSubRequest.requesterCountryCode,
              id: pendingSubRequest.requesterPlayerId,
              personaName: pendingSubRequest.requesterPersonaName,
              profileUrl: pendingSubRequest.requesterProfileUrl,
              steamId: pendingSubRequest.requesterSteamId,
            }),
            target: toSubRequestParticipantState({
              avatarUrl: pendingSubRequest.targetAvatarUrl,
              countryCode: pendingSubRequest.targetCountryCode,
              id: pendingSubRequest.targetPlayerId,
              personaName: pendingSubRequest.targetPersonaName,
              profileUrl: pendingSubRequest.targetProfileUrl,
              steamId: pendingSubRequest.targetSteamId,
            }),
          }
        : null,
      queueId: match.queueId,
      readyDeadlineAt:
        readyDeadlineAtOverride === undefined
          ? match.readyDeadlineAt?.toISOString() ?? null
          : readyDeadlineAtOverride?.toISOString() ?? null,
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
    const [match, activeLock, outgoingSubRequest, incomingSubRequest] = await Promise.all([
      deps.getLatestPlayerActiveMatch(player.id),
      deps.getActivePlayerLock(player.id),
      deps.getPendingSubRequestForRequester(player.id),
      deps.getPendingSubRequestForTarget(player.id),
    ]);
    const lockState = lockToState(activeLock);
    const outgoingSubRequestState = toSubRequestState(outgoingSubRequest);
    const incomingSubRequestState = toSubRequestState(incomingSubRequest);

    if (match) {
      const viewerReadyDeadlineAt =
        match.status === "ready_check"
          ? await deps.ensureReadyCheckPlayerDeadline(match.id, player.id)
          : undefined;
      const [publicState, rating, ratings] = await Promise.all([
        deps.getPublicState(),
        deps.getPlayerSeasonRating(player.id, match.seasonId),
        deps.getPlayerActiveRatings(player.id),
      ]);
      const matchState = await buildMatchState(match, viewerReadyDeadlineAt);

      return {
        activeLock: lockState,
        incomingSubRequest: incomingSubRequestState,
        match: matchState,
        outgoingSubRequest: outgoingSubRequestState,
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
        incomingSubRequest: incomingSubRequestState,
        outgoingSubRequest: outgoingSubRequestState,
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
        incomingSubRequest: incomingSubRequestState,
        match: matchState,
        outgoingSubRequest: outgoingSubRequestState,
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
      incomingSubRequest: incomingSubRequestState,
      outgoingSubRequest: outgoingSubRequestState,
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
