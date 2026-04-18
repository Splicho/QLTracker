const DEFAULT_CA_ROUND_LIMIT = 10;
const MINIMUM_RATED_CA_COMPLETION_RATIO = 0.5;

export function parsePickupFinalScore(finalScore: string | null | undefined) {
  if (typeof finalScore !== "string") {
    return null;
  }

  const match = finalScore.trim().match(/^(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }

  const left = Number.parseInt(match[1] ?? "", 10);
  const right = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return null;
  }

  return { left, right };
}

export function minimumRatedRoundsPlayed(roundLimit = DEFAULT_CA_ROUND_LIMIT) {
  const maxPossibleRounds = roundLimit * 2 - 1;
  return Math.ceil(maxPossibleRounds * MINIMUM_RATED_CA_COMPLETION_RATIO);
}

export function shouldApplyPickupRating(finalScore: string | null | undefined) {
  const parsedScore = parsePickupFinalScore(finalScore);
  if (!parsedScore) {
    return false;
  }

  return parsedScore.left + parsedScore.right >= minimumRatedRoundsPlayed();
}
