import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupQueueDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const paramsSchema = z.object({
  queueId: z.string().min(1),
})

const patchSchema = z
  .object({
    description: z.string().trim().max(500).optional().nullable(),
    enabled: z.boolean().optional(),
    name: z.string().trim().min(1).max(120).optional(),
    playerCount: z.number().int().min(2).max(16).optional(),
    slug: z.string().trim().min(1).max(120).optional(),
    teamSize: z.number().int().min(1).max(8).optional(),
  })
  .superRefine((value, context) => {
    const nextTeamSize = value.teamSize
    const nextPlayerCount = value.playerCount
    if (
      nextTeamSize !== undefined &&
      nextPlayerCount !== undefined &&
      nextPlayerCount !== nextTeamSize * 2
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Player count must be exactly double the team size.",
        path: ["playerCount"],
      })
    }
  })

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeSlug(value: string | undefined) {
  const trimmed = value?.trim().toLowerCase()
  if (!trimmed) {
    return undefined
  }

  const slug = trimmed
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)

  if (!slug) {
    throw new Error("Queue slug could not be generated.")
  }

  return slug
}

export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  context: { params: Promise<{ queueId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const params = paramsSchema.parse(await context.params)
    const patch = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const existing = await prisma.pickupQueue.findUniqueOrThrow({
      where: { id: params.queueId },
    })
    const teamSize = patch.teamSize ?? existing.teamSize
    const playerCount = patch.playerCount ?? existing.playerCount

    if (playerCount !== teamSize * 2) {
      throw new Error("Player count must be exactly double the team size.")
    }

    const queue = await prisma.pickupQueue.update({
      where: { id: params.queueId },
      data: {
        description:
          patch.description !== undefined
            ? normalizeOptional(patch.description)
            : undefined,
        enabled: patch.enabled,
        name: patch.name,
        playerCount: patch.playerCount,
        slug: normalizeSlug(patch.slug),
        teamSize: patch.teamSize,
      },
    })

    return NextResponse.json({
      queue: toPickupQueueDto(queue),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup queue settings could not be saved.")
  }
}
