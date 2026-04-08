import type {
  PickupActiveRatingRow,
  PickupActiveRatingState,
  PickupPlayerRatingState,
  PickupRatingRow,
} from "./types.js";

export function defaultDisplayRating(mu: number) {
  return Math.max(0, Math.round(mu));
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
    losses: rating.losses,
    mu: rating.mu,
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
    losses: rating.losses,
    mu: rating.mu,
    queueId: rating.queueId,
    queueName: rating.queueName,
    queueSlug: rating.queueSlug,
    seasonId: rating.seasonId,
    seasonName: rating.seasonName,
    sigma: rating.sigma,
    wins: rating.wins,
  };
}
