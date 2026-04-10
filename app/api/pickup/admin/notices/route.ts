import { NextResponse } from "next/server"
import type { PickupNoticeVariant } from "@prisma/client"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import {
  createPickupNotice,
  listPickupNoticeDtos,
  pickupNoticeLinkHrefSchema,
  toPickupNoticeDto,
} from "@/lib/server/notices"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"

const bodySchema = z
  .object({
    content: z.string().trim().min(1).max(500),
    dismissable: z.boolean(),
    enabled: z.boolean(),
    linkHref: pickupNoticeLinkHrefSchema,
    linkLabel: z.string().trim().min(1).max(80).nullable().optional(),
    variant: z.enum(["success", "danger", "alert", "info"]),
  })
  .superRefine((value, ctx) => {
    const hasHref = Boolean(value.linkHref)
    const hasLabel = Boolean(value.linkLabel)

    if (hasHref !== hasLabel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Link URL and label must be set together.",
        path: hasHref ? ["linkLabel"] : ["linkHref"],
      })
    }
  })

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requirePickupAdminSession(request)

    return NextResponse.json({
      notices: await listPickupNoticeDtos(),
    })
  } catch (error) {
    return handleRouteError(error, "Notices could not be loaded.")
  }
}

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request)
    const body = bodySchema.parse(await request.json())

    const notice = await createPickupNotice({
      content: body.content,
      dismissable: body.dismissable,
      enabled: body.enabled,
      linkHref: body.linkHref ?? null,
      linkLabel: body.linkLabel ?? null,
      variant: body.variant as PickupNoticeVariant,
    })

    return NextResponse.json({
      notice: toPickupNoticeDto(notice),
    })
  } catch (error) {
    return handleRouteError(error, "Notice could not be created.")
  }
}
