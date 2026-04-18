import type {
  PickupActiveRatingRow,
  PickupActiveRatingState,
  PickupPlayerRatingState,
  PickupRankState,
  PickupRatingRow,
} from "./types.js";

export const PICKUP_PLACEMENT_GAMES_REQUIRED = 10;

export function defaultDisplayRating(mu: number) {
  return Math.max(0, Math.round(mu));
}

function placementState(gamesPlayed: number) {
  const placementGamesPlayed = Math.min(gamesPlayed, PICKUP_PLACEMENT_GAMES_REQUIRED);
  const placementGamesRemaining = Math.max(
    0,
    PICKUP_PLACEMENT_GAMES_REQUIRED - gamesPlayed,
  );

  return {
    isPlaced: gamesPlayed >= PICKUP_PLACEMENT_GAMES_REQUIRED,
    placementGamesPlayed,
    placementGamesRemaining,
    placementGamesRequired: PICKUP_PLACEMENT_GAMES_REQUIRED,
  };
}

function rankToState(rating: PickupRatingRow): PickupRankState | null {
  if (
    rating.gamesPlayed < PICKUP_PLACEMENT_GAMES_REQUIRED ||
    !rating.rankId ||
    !rating.rankTitle ||
    rating.rankMinRating == null
  ) {
    return null;
  }

  return {
    badgeUrl: rating.rankBadgeUrl ?? null,
    id: rating.rankId,
    minRating: rating.rankMinRating,
    title: rating.rankTitle,
  };
}

export function ratingToState(
  rating: PickupRatingRow | null,
): PickupPlayerRatingState {
  if (!rating) {
    return null;
  }

  return {
    displayRating: rating.displayRating,
    gamesPlayed: rating.gamesPlayed,
    ...placementState(rating.gamesPlayed),
    losses: rating.losses,
    mu: rating.mu,
    rank: rankToState(rating),
    sigma: rating.sigma,
    wins: rating.wins,
  };
}

export function activeRatingToState(
  rating: PickupActiveRatingRow,
): PickupActiveRatingState {
  return {
    displayRating: rating.displayRating,
    gamesPlayed: rating.gamesPlayed,
    ...placementState(rating.gamesPlayed),
    losses: rating.losses,
    mu: rating.mu,
    queueId: rating.queueId,
    queueName: rating.queueName,
    queueSlug: rating.queueSlug,
    rank: rankToState(rating),
    seasonId: rating.seasonId,
    seasonName: rating.seasonName,
    sigma: rating.sigma,
    wins: rating.wins,
  };
}
