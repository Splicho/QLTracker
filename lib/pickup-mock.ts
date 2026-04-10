import type {
  PickupMatchPlayerCard,
  PickupMatchState,
  PickupPlayer,
  PickupPlayerState,
  PickupPublicState,
  PickupQueueSummary,
  PickupRating,
} from "@/lib/pickup";

export type PickupMockStage =
  | "idle"
  | "queue"
  | "ready_check"
  | "veto"
  | "provisioning"
  | "server_ready"
  | "live"
  | "completed";

const MOCK_QUEUE_ID = "mock-4v4-ca";
const MOCK_SEASON_ID = "mock-season";
const MOCK_MATCH_ID = "mock-match-001";

const mockQueue: PickupQueueSummary = {
  currentPlayers: 0,
  description: "Mock 4v4 Clan Arena queue",
  enabled: true,
  id: MOCK_QUEUE_ID,
  name: "4v4 CA",
  playerCount: 8,
  players: [],
  readyCheckDurationSeconds: 30,
  slug: "4v4-ca",
  teamSize: 4,
  vetoTurnDurationSeconds: 20,
};

const mockSeason: PickupPublicState["season"] = {
  endsAt: new Date("2026-06-30T23:59:59.000Z").toISOString(),
  id: MOCK_SEASON_ID,
  name: "Spring 2026",
  startsAt: new Date("2026-04-01T00:00:00.000Z").toISOString(),
  status: "active",
};

const fallbackViewer: PickupPlayer = {
  avatarUrl: null,
  id: "mock-viewer",
  isAdmin: false,
  personaName: "Mock Player",
  profileUrl: null,
  steamId: "76561198000000000",
};

const mockNames = [
  "^2Zero4",
  "^5Nyx",
  "^1Aero",
  "^3Mako",
  "^6Rune",
  "^7Keen",
  "^4Vanta",
];

function createPublicState(currentPlayers: number, viewer: PickupPlayer): PickupPublicState {
  const queuePlayers =
    currentPlayers > 0
      ? [
          {
            avatarUrl: viewer.avatarUrl,
            id: viewer.id,
            joinedAt: new Date().toISOString(),
            personaName: viewer.personaName,
            profileUrl: viewer.profileUrl,
            steamId: viewer.steamId,
          },
          ...mockNames.slice(0, Math.max(0, currentPlayers - 1)).map((name, index) => ({
            avatarUrl: null,
            id: `mock-queue-player-${index + 1}`,
            joinedAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
            personaName: name,
            profileUrl: null,
            steamId: `7656119801000000${index + 1}`,
          })),
        ]
      : [];

  return {
    queue: {
      ...mockQueue,
      currentPlayers,
      players: queuePlayers,
    },
    queues: [
      {
        ...mockQueue,
        currentPlayers,
        players: queuePlayers,
      },
    ],
    season: mockSeason,
  };
}

function createViewer(viewer: PickupPlayer | null) {
  return viewer ?? fallbackViewer;
}

function createMockRating(): PickupRating {
  return {
    displayRating: 1000,
    gamesPlayed: 0,
    losses: 0,
    mu: 1000,
    sigma: 150,
    wins: 0,
  };
}

function createPlayerCard(
  player: PickupPlayer,
  overrides: Partial<PickupMatchPlayerCard> = {},
): PickupMatchPlayerCard {
  return {
    avatarUrl: player.avatarUrl,
    displayAfter: null,
    displayBefore: 1000,
    id: player.id,
    isCaptain: false,
    joinedAt: new Date("2026-04-06T18:00:00.000Z").toISOString(),
    personaName: player.personaName,
    profileUrl: player.profileUrl,
    readyConfirmedAt: null,
    readyState: "pending",
    steamId: player.steamId,
    team: null,
    won: null,
    ...overrides,
  };
}

function createMatchPlayers(viewer: PickupPlayer) {
  const now = Date.now();
  const viewerCard = createPlayerCard(viewer, {
    displayBefore: 1000,
    id: viewer.id,
    isCaptain: true,
    joinedAt: new Date(now - 8 * 60_000).toISOString(),
    personaName: viewer.personaName,
    steamId: viewer.steamId,
    team: "left",
  });

  const generatedPlayers = mockNames.map((name, index) =>
    createPlayerCard(
      {
        avatarUrl: null,
        id: `mock-player-${index + 1}`,
        isAdmin: false,
        personaName: name,
        profileUrl: null,
        steamId: `7656119800000000${index + 1}`,
      },
      {
        displayBefore: 980 + index * 15,
        isCaptain: index === 3,
        joinedAt: new Date(now - (7 - index) * 60_000).toISOString(),
        readyState: "ready",
        team: index < 3 ? "left" : "right",
      },
    ),
  );

  const left = [
    viewerCard,
    generatedPlayers[0],
    generatedPlayers[1],
    generatedPlayers[2],
  ];
  const right = [
    generatedPlayers[3],
    generatedPlayers[4],
    generatedPlayers[5],
    generatedPlayers[6],
  ];

  right[0] = {
    ...right[0],
    isCaptain: true,
  };

  return { left, right };
}

function createBaseMatch(
  stage: Exclude<PickupMockStage, "idle" | "queue">,
  viewer: PickupPlayer,
): PickupMatchState {
  const teams = createMatchPlayers(viewer);
  const viewerCard = teams.left[0];
  const rightCaptain = teams.right[0];

  const readyTeams =
    stage === "ready_check"
      ? {
          left: teams.left.map((player) => ({
            ...player,
            readyConfirmedAt: null,
            readyState: "pending" as const,
          })),
          right: teams.right.map((player) => ({
            ...player,
            readyConfirmedAt: null,
            readyState: "pending" as const,
          })),
        }
      : {
          left: teams.left.map((player) => ({
            ...player,
            readyConfirmedAt: new Date().toISOString(),
            readyState: "ready" as const,
          })),
          right: teams.right.map((player) => ({
            ...player,
            readyConfirmedAt: new Date().toISOString(),
            readyState: "ready" as const,
          })),
        };

  const availableMaps =
    stage === "completed" || stage === "live" || stage === "server_ready" || stage === "provisioning"
      ? ["campgrounds"]
      : stage === "veto"
        ? ["campgrounds", "bloodrun", "toxicity", "corruptedkeep"]
        : ["campgrounds", "bloodrun", "toxicity", "corruptedkeep", "furiousheights"];

  const bannedMaps =
    stage === "completed" || stage === "live" || stage === "server_ready" || stage === "provisioning"
      ? ["bloodrun", "toxicity", "corruptedkeep"]
      : [];

  const finalMapKey =
    stage === "completed" || stage === "live" || stage === "server_ready" || stage === "provisioning"
      ? "campgrounds"
      : null;

  return {
    balanceSummary: {
      captainPlayerIds: {
        left: viewerCard.id,
        right: rightCaptain.id,
      },
      ratingDelta: 12,
      teamRatings: {
        left: 4012,
        right: 3998,
      },
    },
    completedAt: stage === "completed" ? new Date().toISOString() : null,
    finalMapKey,
    finalScore: stage === "completed" ? "2-1" : null,
    id: MOCK_MATCH_ID,
    liveStartedAt: stage === "live" || stage === "completed" ? new Date().toISOString() : null,
    queueId: MOCK_QUEUE_ID,
    readyDeadlineAt:
      stage === "ready_check" ? new Date(Date.now() + 30_000).toISOString() : null,
    seasonId: MOCK_SEASON_ID,
    server: {
      countryCode:
        stage === "server_ready" || stage === "live" || stage === "completed" ? "DE" : null,
      countryName:
        stage === "server_ready" || stage === "live" || stage === "completed" ? "Germany" : null,
      ip: stage === "server_ready" || stage === "live" || stage === "completed" ? "91.99.183.42" : null,
      joinAddress:
        stage === "server_ready" || stage === "live" || stage === "completed"
          ? "91.99.183.42:27960"
          : null,
      port: stage === "server_ready" || stage === "live" || stage === "completed" ? 27960 : null,
      provisionedAt:
        stage === "server_ready" || stage === "live" || stage === "completed"
          ? new Date().toISOString()
          : null,
    },
    status: stage,
    teams: readyTeams,
    veto: {
      availableMaps,
      bannedMaps,
      currentCaptainPlayerId: stage === "veto" ? viewerCard.id : null,
      deadlineAt: stage === "veto" ? new Date(Date.now() + 20_000).toISOString() : null,
      turns:
        stage === "completed" || stage === "live" || stage === "server_ready" || stage === "provisioning"
          ? [
              {
                captainPlayerId: viewerCard.id,
                mapKey: "bloodrun",
                order: 1,
                reason: "captain",
              },
              {
                captainPlayerId: rightCaptain.id,
                mapKey: "toxicity",
                order: 2,
                reason: "captain",
              },
              {
                captainPlayerId: viewerCard.id,
                mapKey: "corruptedkeep",
                order: 3,
                reason: "captain",
              },
            ]
          : [],
    },
    winnerTeam: stage === "completed" ? "left" : null,
  };
}

export function createMockPickupState(
  stage: PickupMockStage,
  viewer: PickupPlayer | null,
): PickupPlayerState {
  const safeViewer = createViewer(viewer);
  const rating = createMockRating();

  if (stage === "idle") {
    return {
      publicState: createPublicState(0, safeViewer),
      rating,
      stage: "idle",
      viewer: safeViewer,
    };
  }

  if (stage === "queue") {
    return {
      publicState: createPublicState(1, safeViewer),
      queue: {
        joinedAt: new Date().toISOString(),
        playerCount: 8,
        queueId: MOCK_QUEUE_ID,
        queueSlug: "4v4-ca",
      },
      rating,
      stage: "queue",
      viewer: safeViewer,
    };
  }

  return {
    match: createBaseMatch(stage, safeViewer),
    publicState: createPublicState(8, safeViewer),
    rating,
    stage,
    viewer: safeViewer,
  };
}

export function applyMockVetoBan(state: PickupPlayerState, mapKey: string): PickupPlayerState {
  if (state.stage !== "veto") {
    return state;
  }

  const availableMaps = state.match.veto.availableMaps.filter((value) => value !== mapKey);
  if (availableMaps.length === state.match.veto.availableMaps.length) {
    return state;
  }

  const currentCaptainPlayerId = state.match.veto.currentCaptainPlayerId;
  const nextCaptainPlayerId =
    currentCaptainPlayerId === state.match.balanceSummary?.captainPlayerIds.left
      ? state.match.balanceSummary.captainPlayerIds.right
      : state.match.balanceSummary?.captainPlayerIds.left ?? null;

  const nextState: PickupPlayerState = {
    ...state,
    match: {
      ...state.match,
      finalMapKey: availableMaps.length === 1 ? availableMaps[0] : null,
      status: availableMaps.length === 1 ? "provisioning" : "veto",
      veto: {
        ...state.match.veto,
        availableMaps,
        bannedMaps: [...state.match.veto.bannedMaps, mapKey],
        currentCaptainPlayerId: availableMaps.length === 1 ? null : nextCaptainPlayerId,
        turns: [
          ...state.match.veto.turns,
          {
            captainPlayerId: currentCaptainPlayerId ?? state.viewer.id,
            mapKey,
            order: state.match.veto.turns.length + 1,
            reason: "captain",
          },
        ],
      },
    },
  };

  if (availableMaps.length === 1) {
    return {
      ...nextState,
      stage: "provisioning",
      match: {
        ...nextState.match,
        finalMapKey: availableMaps[0],
        status: "provisioning",
      },
    };
  }

  return nextState;
}

export function applyMockReadyUp(state: PickupPlayerState): PickupPlayerState {
  if (state.stage !== "ready_check") {
    return state;
  }

  const markReady = (player: PickupMatchPlayerCard) =>
    player.id === state.viewer.id
      ? {
          ...player,
          readyConfirmedAt: player.readyConfirmedAt ?? new Date().toISOString(),
          readyState: "ready" as const,
        }
      : player;

  return {
    ...state,
    match: {
      ...state.match,
      teams: {
        left: state.match.teams.left.map(markReady),
        right: state.match.teams.right.map(markReady),
      },
    },
  };
}

export function progressMockReadyCheck(state: PickupPlayerState): PickupPlayerState {
  if (state.stage !== "ready_check") {
    return state;
  }

  const players = [...state.match.teams.left, ...state.match.teams.right];
  const nextPending = players.find((player) => player.readyState !== "ready");
  if (!nextPending) {
    return createMockPickupState("veto", state.viewer);
  }

  const markReady = (player: PickupMatchPlayerCard) =>
    player.id === nextPending.id
      ? {
          ...player,
          readyConfirmedAt: new Date().toISOString(),
          readyState: "ready" as const,
        }
      : player;

  const nextState: PickupPlayerState = {
    ...state,
    match: {
      ...state.match,
      teams: {
        left: state.match.teams.left.map(markReady),
        right: state.match.teams.right.map(markReady),
      },
    },
  };

  const allReady = [...nextState.match.teams.left, ...nextState.match.teams.right].every(
    (player) => player.readyState === "ready",
  );

  if (allReady) {
    return createMockPickupState("veto", state.viewer);
  }

  return nextState;
}
