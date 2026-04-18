import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupRankDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"
import { deletePickupImagesFromR2 } from "@/lib/server/r2"

const paramsSchema = z.object({
  rankId: z.string().min(1),
})

const patchSchema = z.object({
  active: z.boolean().optional(),
  badgeUrl: z.string().trim().url().optional().nullable(),
  minRating: z.coerce.number().int().min(0).max(10000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  title: z.string().trim().min(1).max(80).optional(),
})

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ rankId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const patch = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const existing = await prisma.pickupRank.findUnique({
      where: {
        id: params.rankId,
      },
    })

    if (!existing) {
      routeError(404, "Pickup rank not found.")
    }

    const rank = await prisma.pickupRank.update({
      where: {
        id: existing.id,
      },
      data: {
        active: patch.active,
        badgeUrl: patch.badgeUrl,
        minRating: patch.minRating,
        sortOrder: patch.sortOrder,
        title: patch.title,
      },
    })

    if (
      patch.badgeUrl !== undefined &&
      existing.badgeUrl &&
      existing.badgeUrl !== patch.badgeUrl
    ) {
      await deletePickupImagesFromR2([existing.badgeUrl])
    }

    return NextResponse.json({
      rank: toPickupRankDto(rank),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup rank could not be updated.")
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ rankId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const prisma = getPrisma()
    const existing = await prisma.pickupRank.findUnique({
      where: {
        id: params.rankId,
      },
    })

    if (!existing) {
      routeError(404, "Pickup rank not found.")
    }

    await prisma.pickupRank.delete({
      where: {
        id: existing.id,
      },
    })

    if (existing.badgeUrl) {
      await deletePickupImagesFromR2([existing.badgeUrl])
    }

    return NextResponse.json({
      deletedRankId: params.rankId,
    })
  } catch (error) {
    return handleRouteError(error, "Pickup rank could not be deleted.")
  }
}
