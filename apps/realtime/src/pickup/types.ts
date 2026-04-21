import type express from "express";

export type PickupQueueRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  teamSize: number;
  playerCount: number;
  enabled: boolean;
};

export type PickupSettingsRow = {
  callbackSecret: string | null;
  id: string;
  provisionApiUrl: string | null;
  provisionAuthToken: string | null;
  readyCheckDurationSeconds: number;
  vetoTurnDurationSeconds: number;
};

export type PickupSeasonRow = {
  id: string;
  queueId: string;
  name: string;
  status: "draft" | "active" | "completed";
  durationPreset: "one_month" | "three_month" | "custom";
  startingRating: number;
  startsAt: Date;
  endsAt: Date;
};

export type PickupPlayerIdentity = {
  avatarUrl: string | null;
  countryCode: string | null;
  id: string;
  personaName: string;
  profileUrl: string | null;
  steamId: string;
};

export type PickupSessionIdentity = {
  player: PickupPlayerIdentity;
  sessionId: string;
  token: string;
};

export type PickupRatingRow = {
  displayRating: number;
  gamesPlayed: number;
  losses: number;
  mu: number;
  playerId: string;
  rankBadgeUrl?: string | null;
  rankId?: string | null;
  rankMinRating?: number | null;
  rankTitle?: string | null;
  sigma: number;
  wins: number;
};

export type PickupActiveRatingRow = PickupRatingRow & {
  queueId: string;
  queueName: string;
  queueSlug: string;
  seasonId: string;
  seasonName: string;
};

export type PickupQueueMemberRow = PickupPlayerIdentity & {
  joinedAt: Date;
  playerId: string;
  queueMemberId: string;
};

export type PickupPlayerLockRow = {
  expiresAt: Date | null;
  id: string;
  reason: string | null;
};

export type PickupPlayerLockState = {
  expiresAt: string | null;
  id: string;
  reason: string | null;
};

export type PickupVetoTurn = {
  captainPlayerId: string;
  mapKey: string;
  order: number;
  reason: "captain" | "timeout";
};

export type PickupVetoState = {
  availableMaps: string[];
  bannedMaps: string[];
  turns: PickupVetoTurn[];
  turnCaptainPlayerId: string | null;
};

export type PickupBalanceSummary = {
  captainPlayerIds: {
    left: string;
    right: string;
  };
  ratingDelta: number;
  ratingSource?: "pickup" | "qlstats";
  teamRatings: {
    left: number;
    right: number;
  };
};

export type PickupRankState = {
  badgeUrl: string | null;
  id: string;
  minRating: number;
  title: string;
};

export type PickupMatchRow = {
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

export type PickupMatchPlayerRow = PickupPlayerIdentity & {
  matchId: string;
  matchPlayerId: string;
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

export type PickupMatchSubRequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "expired";

export type PickupMatchSubstitutionStage = "veto" | "server_ready";

export type PickupSubRequestParticipantState = PickupPlayerIdentity;

export type PickupSubRequestState = {
  createdAt: string;
  expiresAt: string;
  finalMapKey: string | null;
  id: string;
  matchId: string;
  queueId: string;
  queueName: string;
  queueSlug: string;
  requester: PickupSubRequestParticipantState;
  stage: PickupMatchSubstitutionStage;
  status: PickupMatchSubRequestStatus;
  target: PickupSubRequestParticipantState;
};

export type PickupMatchPendingSubRequestState = {
  createdAt: string;
  expiresAt: string;
  id: string;
  requester: PickupSubRequestParticipantState;
  target: PickupSubRequestParticipantState;
};

export type PickupMatchSubRequestRow = {
  createdAt: Date;
  expiresAt: Date;
  finalMapKey: string | null;
  id: string;
  matchId: string;
  queueId: string;
  queueName: string;
  queueSlug: string;
  requesterAvatarUrl: string | null;
  requesterCountryCode: string | null;
  requesterPersonaName: string;
  requesterPlayerId: string;
  requesterProfileUrl: string | null;
  requesterSteamId: string;
  respondedAt: Date | null;
  stage: PickupMatchSubstitutionStage;
  status: PickupMatchSubRequestStatus;
  targetAvatarUrl: string | null;
  targetCountryCode: string | null;
  targetPersonaName: string;
  targetPlayerId: string;
  targetProfileUrl: string | null;
  targetSteamId: string;
};

export type PickupQueueSeasonState = {
  endsAt: string;
  id: string;
  name: string;
  startsAt: string;
  status: string;
} | null;

export type PickupQueuePublicState = {
  currentPlayers: number;
  description: string | null;
  enabled: boolean;
  id: string;
  name: string;
  playerCount: number;
  players: Array<PickupPlayerIdentity & { joinedAt: string }>;
  readyCheckDurationSeconds: number;
  season: PickupQueueSeasonState;
  slug: string;
  teamSize: number;
  vetoTurnDurationSeconds: number;
};

export type PickupPublicState = {
  queue: PickupQueuePublicState | null;
  queues: PickupQueuePublicState[];
  season: PickupQueueSeasonState;
};

export type PickupPlayerRatingState = {
  displayRating: number;
  gamesPlayed: number;
  isPlaced: boolean;
  losses: number;
  mu: number;
  placementGamesPlayed: number;
  placementGamesRemaining: number;
  placementGamesRequired: number;
  rank: PickupRankState | null;
  sigma: number;
  wins: number;
} | null;

export type PickupActiveRatingState = {
  displayRating: number;
  gamesPlayed: number;
  isPlaced: boolean;
  losses: number;
  mu: number;
  placementGamesPlayed: number;
  placementGamesRemaining: number;
  placementGamesRequired: number;
  queueId: string;
  queueName: string;
  queueSlug: string;
  rank: PickupRankState | null;
  seasonId: string;
  seasonName: string;
  sigma: number;
  wins: number;
};

export type PickupPlayerCard = {
  avatarUrl: string | null;
  countryCode: string | null;
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

export type PickupMatchState = {
  balanceSummary: PickupBalanceSummary | null;
  completedAt: string | null;
  finalMapKey: string | null;
  finalScore: string | null;
  id: string;
  liveStartedAt: string | null;
  pendingSubRequest: PickupMatchPendingSubRequestState | null;
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

export type PickupPlayerState =
  | {
      activeLock: PickupPlayerLockState | null;
      incomingSubRequest: PickupSubRequestState | null;
      outgoingSubRequest: PickupSubRequestState | null;
      publicState: PickupPublicState;
      rating: PickupPlayerRatingState;
      ratings: PickupActiveRatingState[];
      serverNow: string;
      stage: "idle";
      viewer: PickupPlayerIdentity;
    }
  | {
      activeLock: PickupPlayerLockState | null;
      incomingSubRequest: PickupSubRequestState | null;
      outgoingSubRequest: PickupSubRequestState | null;
      publicState: PickupPublicState;
      queue: {
        joinedAt: string;
        playerCount: number;
        queueId: string;
        queueSlug: string;
      };
      rating: PickupPlayerRatingState;
      ratings: PickupActiveRatingState[];
      serverNow: string;
      stage: "queue";
      viewer: PickupPlayerIdentity;
    }
  | {
      activeLock: PickupPlayerLockState | null;
      incomingSubRequest: PickupSubRequestState | null;
      outgoingSubRequest: PickupSubRequestState | null;
      match: PickupMatchState;
      publicState: PickupPublicState;
      rating: PickupPlayerRatingState;
      ratings: PickupActiveRatingState[];
      serverNow: string;
      stage:
        | "ready_check"
        | "veto"
        | "provisioning"
        | "server_ready"
        | "live"
        | "completed";
      viewer: PickupPlayerIdentity;
    };

export type RawBodyRequest = express.Request & {
  rawBody?: string;
};
