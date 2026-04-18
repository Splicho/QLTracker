import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupRankDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const paramsSchema = z.object({
  queueId: z.string().min(1),
})

const bodySchema = z.object({
  active: z.boolean().default(true),
  badgeUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .nullable()
    .transform((value) => value ?? null),
  minRating: z.coerce.number().int().min(0).max(10000),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
  title: z.string().trim().min(1).max(80),
})

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ queueId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const queue = await prisma.pickupQueue.findUnique({
      where: {
        id: params.queueId,
      },
      select: {
        id: true,
      },
    })

    if (!queue) {
      routeError(404, "Pickup queue not found.")
    }

    const rank = await prisma.pickupRank.create({
      data: {
        active: body.active,
        badgeUrl: body.badgeUrl,
        minRating: body.minRating,
        queueId: params.queueId,
        sortOrder: body.sortOrder,
        title: body.title,
      },
    })

    return NextResponse.json({
      rank: toPickupRankDto(rank),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup rank could not be created.")
  }
}
