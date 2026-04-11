import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { toPickupQueueDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const bodySchema = z
  .object({
    description: z.string().trim().max(500).optional().nullable(),
    enabled: z.boolean().default(true),
    name: z.string().trim().min(1).max(120),
    playerCount: z.number().int().min(2).max(16),
    slug: z.string().trim().min(1).max(120).optional(),
    teamSize: z.number().int().min(1).max(8),
  })
  .superRefine((value, context) => {
    if (value.playerCount !== value.teamSize * 2) {
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

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request)
    const body = bodySchema.parse(await request.json())
    const prisma = getPrisma()
    const slug = normalizeSlug(body.slug ?? body.name)

    if (!slug) {
      throw new Error("Queue slug could not be generated.")
    }

    const queue = await prisma.pickupQueue.create({
      data: {
        description: normalizeOptional(body.description),
        enabled: body.enabled,
        name: body.name,
        playerCount: body.playerCount,
        slug,
        teamSize: body.teamSize,
      },
    })

    return NextResponse.json({
      queue: toPickupQueueDto(queue),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup queue could not be created.")
  }
}
