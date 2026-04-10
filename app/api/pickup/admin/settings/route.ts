import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { getPickupSettings, toPickupSettingsDto } from "@/lib/server/pickup"
import { getPrisma } from "@/lib/server/prisma"

const patchSchema = z.object({
  callbackSecret: z.string().trim().max(255).optional().nullable(),
  provisionApiUrl: z.string().trim().url().optional().nullable(),
  provisionAuthToken: z.string().trim().max(255).optional().nullable(),
  readyCheckDurationSeconds: z.number().int().min(10).max(120).optional(),
  r2AccountId: z.string().trim().max(255).optional().nullable(),
  r2AccessKeyId: z.string().trim().max(255).optional().nullable(),
  r2BucketName: z.string().trim().max(255).optional().nullable(),
  r2PublicBaseUrl: z.string().trim().url().optional().nullable(),
  r2SecretAccessKey: z.string().trim().max(255).optional().nullable(),
  vetoTurnDurationSeconds: z.number().int().min(10).max(120).optional(),
})

function normalizeOptional(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function preserveSecretOnBlank(
  value: string | null | undefined,
  currentValue: string | null
) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return currentValue
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return currentValue
  }

  return trimmed
}

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requirePickupAdminSession(request)
    return NextResponse.json({
      settings: toPickupSettingsDto(await getPickupSettings()),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup settings could not be loaded.")
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePickupAdminSession(request)
    const patch = patchSchema.parse(await request.json())
    const prisma = getPrisma()
    const existing = await prisma.pickupSettings.findUnique({
      where: {
        id: "default",
      },
    })
    const settings = await prisma.pickupSettings.upsert({
      where: {
        id: "default",
      },
      create: {
        id: "default",
        callbackSecret: normalizeOptional(patch.callbackSecret),
        provisionApiUrl: normalizeOptional(patch.provisionApiUrl),
        provisionAuthToken: normalizeOptional(patch.provisionAuthToken),
        readyCheckDurationSeconds: patch.readyCheckDurationSeconds ?? 30,
        r2AccountId: normalizeOptional(patch.r2AccountId),
        r2AccessKeyId: normalizeOptional(patch.r2AccessKeyId),
        r2BucketName: normalizeOptional(patch.r2BucketName),
        r2PublicBaseUrl: normalizeOptional(patch.r2PublicBaseUrl),
        r2SecretAccessKey: normalizeOptional(patch.r2SecretAccessKey),
        vetoTurnDurationSeconds: patch.vetoTurnDurationSeconds ?? 20,
      },
      update: {
        callbackSecret: preserveSecretOnBlank(
          patch.callbackSecret,
          existing?.callbackSecret ?? null
        ),
        provisionApiUrl:
          patch.provisionApiUrl !== undefined
            ? normalizeOptional(patch.provisionApiUrl)
            : undefined,
        provisionAuthToken: preserveSecretOnBlank(
          patch.provisionAuthToken,
          existing?.provisionAuthToken ?? null
        ),
        readyCheckDurationSeconds: patch.readyCheckDurationSeconds,
        r2AccountId:
          patch.r2AccountId !== undefined
            ? normalizeOptional(patch.r2AccountId)
            : undefined,
        r2AccessKeyId: preserveSecretOnBlank(
          patch.r2AccessKeyId,
          existing?.r2AccessKeyId ?? null
        ),
        r2BucketName:
          patch.r2BucketName !== undefined
            ? normalizeOptional(patch.r2BucketName)
            : undefined,
        r2PublicBaseUrl:
          patch.r2PublicBaseUrl !== undefined
            ? normalizeOptional(patch.r2PublicBaseUrl)
            : undefined,
        r2SecretAccessKey: preserveSecretOnBlank(
          patch.r2SecretAccessKey,
          existing?.r2SecretAccessKey ?? null
        ),
        vetoTurnDurationSeconds: patch.vetoTurnDurationSeconds,
      },
    })

    return NextResponse.json({
      settings: toPickupSettingsDto(settings),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup settings could not be saved.")
  }
}
