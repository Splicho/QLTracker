import type {
  PickupBalanceSummary,
  PickupQueueMemberRow,
  PickupRatingRow,
} from "./types.js";

type RatedPickupQueueMember = PickupQueueMemberRow & {
  balanceRating: number;
  balanceRatingSource: "pickup" | "qlstats";
  rating: PickupRatingRow;
};

function combinations<T>(values: T[], size: number): T[][] {
  if (size === 0) {
    return [[]];
  }

  if (values.length < size) {
    return [];
  }

  if (values.length === size) {
    return [values];
  }

  const [head, ...tail] = values;
  return [
    ...combinations(tail, size - 1).map((combo) => [head, ...combo]),
    ...combinations(tail, size),
  ];
}

function compareByRating(
  left: RatedPickupQueueMember,
  right: RatedPickupQueueMember,
) {
  if (right.balanceRating !== left.balanceRating) {
    return right.balanceRating - left.balanceRating;
  }

  if (left.joinedAt.getTime() !== right.joinedAt.getTime()) {
    return left.joinedAt.getTime() - right.joinedAt.getTime();
  }

  return left.playerId.localeCompare(right.playerId);
}

export function chooseBalancedTeams(
  teamSize: number,
  members: RatedPickupQueueMember[],
) {
  const seeded = [...members].sort(compareByRating);
  const leftSeed = seeded[0]!;
  const rightSeed = seeded[1]!;
  const remaining = seeded.slice(2);
  const leftSlots = teamSize - 1;
  const splits = combinations(remaining, leftSlots);
  let best: {
    delta: number;
    left: RatedPickupQueueMember[];
    right: RatedPickupQueueMember[];
  } | null = null;

  for (const leftCombo of splits) {
    const leftIds = new Set(leftCombo.map((member) => member.playerId));
    const left = [leftSeed, ...leftCombo];
    const right = [
      rightSeed,
      ...remaining.filter((member) => !leftIds.has(member.playerId)),
    ];
    const leftRating = left.reduce(
      (total, member) => total + member.balanceRating,
      0,
    );
    const rightRating = right.reduce(
      (total, member) => total + member.balanceRating,
      0,
    );
    const delta = Math.abs(leftRating - rightRating);

    if (
      !best ||
      delta < best.delta ||
      (delta === best.delta &&
        left.map((member) => member.playerId).join("|") <
          best.left.map((member) => member.playerId).join("|"))
    ) {
      best = { delta, left, right };
    }
  }

  if (!best) {
    throw new Error("Could not balance pickup teams.");
  }

  const leftCaptain =
    best.left[Math.floor(Math.random() * best.left.length)] ?? best.left[0]!;
  const rightCaptain =
    best.right[Math.floor(Math.random() * best.right.length)] ?? best.right[0]!;

  return {
    balanceSummary: {
      captainPlayerIds: {
        left: leftCaptain.playerId,
        right: rightCaptain.playerId,
      },
      ratingSource: members.some(
        (member) => member.balanceRatingSource === "qlstats",
      )
        ? "qlstats"
        : "pickup",
      ratingDelta: best.delta,
      teamRatings: {
        left: Math.round(
          best.left.reduce(
            (total, member) => total + member.balanceRating,
            0,
          ) / best.left.length,
        ),
        right: Math.round(
          best.right.reduce(
            (total, member) => total + member.balanceRating,
            0,
          ) / best.right.length,
        ),
      },
    } satisfies PickupBalanceSummary,
    left: best.left,
    right: best.right,
  };
}
