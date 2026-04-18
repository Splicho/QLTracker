import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupSeasonDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const paramsSchema = z.object({
  seasonId: z.string().min(1),
})

const patchSchema = z.object({
  durationPreset: z.enum(["one_month", "three_month", "custom"]).optional(),
  endsAt: z.string().datetime().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  startsAt: z.string().datetime().optional(),
  startingRating: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.enum(["draft", "active", "completed"]).optional(),
})

const PICKUP_STARTING_RATING_SIGMA = 150

function resolveSeasonEndDate(
  startsAt: Date,
  durationPreset: "one_month" | "three_month" | "custom",
  endsAt?: string
) {
  if (durationPreset === "custom") {
    if (!endsAt) {
      throw new Error("Custom seasons require an end date.")
    }

    return new Date(endsAt)
  }

  const result = new Date(startsAt)
  result.setMonth(
    result.getMonth() + (durationPreset === "three_month" ? 3 : 1)
  )
  return result
}

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const patch = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const existingSeason = await prisma.pickupSeason.findUniqueOrThrow({
      where: {
        id: params.seasonId,
      },
    })

    const startsAt = patch.startsAt
      ? new Date(patch.startsAt)
      : existingSeason.startsAt
    const durationPreset = patch.durationPreset ?? existingSeason.durationPreset
    const endsAt =
      patch.endsAt || patch.durationPreset || patch.startsAt
        ? resolveSeasonEndDate(
            startsAt,
            durationPreset,
            patch.endsAt ?? existingSeason.endsAt.toISOString()
          )
        : existingSeason.endsAt

    const season = await prisma.$transaction(async (tx) => {
      if (patch.status === "active") {
        await tx.pickupSeason.updateMany({
          where: {
            id: {
              not: existingSeason.id,
            },
            queueId: existingSeason.queueId,
            status: "active",
          },
          data: {
            status: "completed",
          },
        })
      }

      const season = await tx.pickupSeason.update({
        where: {
          id: existingSeason.id,
        },
        data: {
          durationPreset,
          endsAt,
          name: patch.name,
          startsAt,
          startingRating: patch.startingRating,
          status: patch.status,
        },
      })

      if (patch.startingRating !== undefined) {
        await tx.pickupPlayerSeasonRating.updateMany({
          where: {
            gamesPlayed: 0,
            seasonId: existingSeason.id,
          },
          data: {
            displayRating: patch.startingRating,
            mu: patch.startingRating,
            seededFrom: "season-starting-rating",
            sigma: PICKUP_STARTING_RATING_SIGMA,
          },
        })
      }

      return season
    })

    return NextResponse.json({
      season: toPickupSeasonDto(season),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup season could not be updated.")
  }
}
