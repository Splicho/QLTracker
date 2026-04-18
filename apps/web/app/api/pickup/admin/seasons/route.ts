import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupSeasonDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const bodySchema = z.object({
  durationPreset: z.enum(["one_month", "three_month", "custom"]),
  endsAt: z.string().datetime().optional(),
  name: z.string().trim().min(1).max(120),
  queueId: z.string().min(1),
  startsAt: z.string().datetime(),
  startingRating: z.coerce.number().int().min(0).max(10000).default(1000),
  status: z.enum(["draft", "active", "completed"]).default("draft"),
})

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

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request)
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const startsAt = new Date(body.startsAt)
    const endsAt = resolveSeasonEndDate(
      startsAt,
      body.durationPreset,
      body.endsAt
    )

    const season = await prisma.$transaction(async (tx) => {
      if (body.status === "active") {
        await tx.pickupSeason.updateMany({
          where: {
            queueId: body.queueId,
            status: "active",
          },
          data: {
            status: "completed",
          },
        })
      }

      return tx.pickupSeason.create({
        data: {
          durationPreset: body.durationPreset,
          endsAt,
          name: body.name,
          queueId: body.queueId,
          startsAt,
          startingRating: body.startingRating,
          status: body.status,
        },
      })
    })

    return NextResponse.json({
      season: toPickupSeasonDto(season),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup season could not be created.")
  }
}
