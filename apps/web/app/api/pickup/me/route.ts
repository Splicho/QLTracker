import { NextResponse } from "next/server"

import { routeError } from "@/lib/server/errors"
import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAppSession } from "@/lib/server/pickup-auth"
import { getPrisma } from "@/lib/server/prisma"
import {
  ensurePickupBootstrapData,
  getPickupPlayerActiveRatings,
  getPreferredPickupPlayerRating,
  refreshPickupPlayerIfStale,
  toPickupActiveRatingDto,
  toPickupPlayerDto,
  toPickupRatingDto,
} from "@/lib/server/pickup"

export const runtime = "nodejs"

const PICKUP_PROFILE_REFRESH_MAX_AGE_MS = 30 * 60 * 1000

export async function GET(request: Request) {
  try {
    const session = await requirePickupAppSession(request)
    const player = await refreshPickupPlayerIfStale(
      session.player,
      PICKUP_PROFILE_REFRESH_MAX_AGE_MS
    )
    await ensurePickupBootstrapData()
    const [rating, ratings] = await Promise.all([
      getPreferredPickupPlayerRating(player.id),
      getPickupPlayerActiveRatings(player.id),
    ])

    return NextResponse.json({
      player: toPickupPlayerDto(player),
      rating: rating ? toPickupRatingDto(rating) : null,
      ratings: ratings.map(toPickupActiveRatingDto),
    })
  } catch (error) {
    return handleRouteError(
      error,
      "Pickup account details could not be loaded."
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requirePickupAppSession(request)
    const prisma = getPrisma()
    const activeMatchMembership = await prisma.pickupMatchPlayer.findFirst({
      where: {
        playerId: session.player.id,
        match: {
          status: {
            in: ["ready_check", "veto", "provisioning", "server_ready", "live"],
          },
        },
      },
      select: {
        matchId: true,
      },
    })

    if (activeMatchMembership) {
      routeError(
        409,
        "Pickup account cannot be disconnected during an active pickup match."
      )
    }

    await prisma.$transaction([
      prisma.pickupQueueMember.deleteMany({
        where: {
          playerId: session.player.id,
        },
      }),
      prisma.pickupLinkSession.deleteMany({
        where: {
          playerId: session.player.id,
        },
      }),
      prisma.pickupAppSession.updateMany({
        where: {
          playerId: session.player.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, "Pickup account could not be disconnected.")
  }
}
