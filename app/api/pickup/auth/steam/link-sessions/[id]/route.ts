import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { toPickupPlayerDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const paramsSchema = z.object({
  id: z.string().min(1),
})

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = paramsSchema.parse(await context.params)
    const prisma = getPrisma()
    const linkSession = await prisma.pickupLinkSession.findUnique({
      where: { id: params.id },
      include: { player: true },
    })

    if (!linkSession) {
      return NextResponse.json(
        { message: "Pickup link session not found." },
        { status: 404 }
      )
    }

    if (
      linkSession.status === "pending" &&
      linkSession.expiresAt.getTime() <= Date.now()
    ) {
      const expired = await prisma.pickupLinkSession.update({
        where: { id: linkSession.id },
        data: {
          errorMessage: "The Steam sign-in session expired before completion.",
          status: "expired",
        },
        include: { player: true },
      })

      return NextResponse.json({
        errorMessage: expired.errorMessage,
        expiresAt: expired.expiresAt.toISOString(),
        id: expired.id,
        player: expired.player ? toPickupPlayerDto(expired.player) : null,
        status: expired.status,
      })
    }

    if (
      linkSession.flow === "launcher" &&
      linkSession.status === "complete" &&
      linkSession.appSessionToken
    ) {
      const sessionToken = linkSession.appSessionToken
      const consumed = await prisma.pickupLinkSession.update({
        where: { id: linkSession.id },
        data: {
          appSessionToken: null,
        },
        include: { player: true },
      })

      return NextResponse.json({
        errorMessage: consumed.errorMessage,
        expiresAt: consumed.expiresAt.toISOString(),
        id: consumed.id,
        player: consumed.player ? toPickupPlayerDto(consumed.player) : null,
        sessionToken,
        status: consumed.status,
      })
    }

    return NextResponse.json({
      errorMessage: linkSession.errorMessage,
      expiresAt: linkSession.expiresAt.toISOString(),
      id: linkSession.id,
      player: linkSession.player ? toPickupPlayerDto(linkSession.player) : null,
      status: linkSession.status,
    })
  } catch (error) {
    return handleRouteError(error, "Pickup sign-in status could not be loaded.")
  }
}
