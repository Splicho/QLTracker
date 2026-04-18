import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import {
  getPickupAdminLocks,
  toPickupPlayerLockDto,
} from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const bodySchema = z
  .object({
    expiresAt: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    reason: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    steamId: z.string().trim().regex(/^\d{17}$/, "A 17-digit SteamID64 is required."),
  })
  .superRefine((value, context) => {
    if (!value.expiresAt) {
      return
    }

    const expiresAt = new Date(value.expiresAt)
    if (Number.isNaN(expiresAt.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration date is invalid.",
        path: ["expiresAt"],
      })
      return
    }

    if (expiresAt.getTime() <= Date.now()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Expiration date must be in the future.",
        path: ["expiresAt"],
      })
    }
  })

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await requirePickupAdminSession(request)
    return NextResponse.json(await getPickupAdminLocks(session.player))
  } catch (error) {
    return handleRouteError(error, "Pickup player locks could not be loaded.")
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePickupAdminSession(request)
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const player = await prisma.pickupPlayer.findUnique({
      where: {
        steamId: body.steamId,
      },
    })

    if (!player) {
      routeError(404, "Pickup player was not found.")
    }

    const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    const lock = await prisma.$transaction(async (transaction) => {
      await transaction.pickupPlayerLock.updateMany({
        where: {
          playerId: player.id,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        data: {
          revokedAt: new Date(),
          revokedBySteamId: session.player.steamId,
        },
      })
      await transaction.pickupQueueMember.deleteMany({
        where: {
          playerId: player.id,
        },
      })

      return transaction.pickupPlayerLock.create({
        data: {
          createdBySteamId: session.player.steamId,
          expiresAt,
          playerId: player.id,
          reason: body.reason,
        },
        include: {
          player: true,
        },
      })
    })

    return NextResponse.json({
      lock: toPickupPlayerLockDto(lock),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup player lock could not be created.")
  }
}
