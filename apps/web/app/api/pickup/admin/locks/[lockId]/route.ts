import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupPlayerLockDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const paramsSchema = z.object({
  lockId: z.string().min(1),
})

export const runtime = "nodejs"

export async function DELETE(
  request: Request,
  context: { params: Promise<{ lockId: string }> }
) {
  try {
    const session = await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const prisma = getPrisma()
    const existing = await prisma.pickupPlayerLock.findUnique({
      where: {
        id: params.lockId,
      },
      include: {
        player: true,
      },
    })

    if (!existing) {
      routeError(404, "Pickup player lock was not found.")
    }

    const lock = await prisma.pickupPlayerLock.update({
      where: {
        id: existing.id,
      },
      data: {
        revokedAt: existing.revokedAt ?? new Date(),
        revokedBySteamId: existing.revokedBySteamId ?? session.player.steamId,
      },
      include: {
        player: true,
      },
    })

    return NextResponse.json({
      lock: toPickupPlayerLockDto(lock),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup player lock could not be revoked.")
  }
}
