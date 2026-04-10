import type { PickupNotice, PickupNoticeVariant } from "@prisma/client"
import { z } from "zod"

import { getPrisma } from "@/lib/server/prisma"

const MAX_NOTICE_LINK_HREF = 2000

/** `z.string().url()` rejects `/news/foo`; admins often paste on-site paths. */
export function isValidPickupNoticeLinkHref(raw: string): boolean {
  const s = raw.trim()
  if (!s) {
    return false
  }
  if (s.startsWith("//")) {
    return false
  }
  if (s.startsWith("/")) {
    return (
      s.length <= MAX_NOTICE_LINK_HREF && !/[\x00-\x1f\x7f\\]/.test(s)
    )
  }
  try {
    const u = new URL(s)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

export const pickupNoticeLinkHrefSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || val === undefined) {
      return null
    }
    if (typeof val !== "string") {
      return val
    }
    const t = val.trim()
    return t === "" ? null : t
  },
  z
    .union([
      z.null(),
      z
        .string()
        .max(MAX_NOTICE_LINK_HREF)
        .refine(isValidPickupNoticeLinkHref, {
          message:
            "Link must be https://… or a path on this site starting with / (e.g. /news/slug).",
        }),
    ])
    .optional()
)

export type PickupNoticeDto = {
  content: string
  createdAt: string
  dismissable: boolean
  enabled: boolean
  id: string
  linkHref: string | null
  linkLabel: string | null
  updatedAt: string
  variant: PickupNoticeVariant
}

export type PublicPickupNoticeDto = {
  content: string
  dismissable: boolean
  id: string
  linkHref: string | null
  linkLabel: string | null
  variant: PickupNoticeVariant
}

export function toPickupNoticeDto(notice: PickupNotice): PickupNoticeDto {
  return {
    content: notice.content,
    createdAt: notice.createdAt.toISOString(),
    dismissable: notice.dismissable,
    enabled: notice.enabled,
    id: notice.id,
    linkHref: notice.linkHref ?? null,
    linkLabel: notice.linkLabel ?? null,
    updatedAt: notice.updatedAt.toISOString(),
    variant: notice.variant,
  }
}

export function toPublicPickupNoticeDto(
  notice: PickupNotice
): PublicPickupNoticeDto {
  return {
    content: notice.content,
    dismissable: notice.dismissable,
    id: notice.id,
    linkHref: notice.linkHref ?? null,
    linkLabel: notice.linkLabel ?? null,
    variant: notice.variant,
  }
}

export async function listPickupNoticeDtos() {
  const notices = await getPrisma().pickupNotice.findMany({
    orderBy: [
      { enabled: "desc" },
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
  })

  return notices.map(toPickupNoticeDto)
}

export async function listPublicPickupNoticeDtos() {
  const notices = await getPrisma().pickupNotice.findMany({
    where: {
      enabled: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })

  return notices.map(toPublicPickupNoticeDto)
}

export async function createPickupNotice(input: {
  content: string
  dismissable: boolean
  enabled: boolean
  linkHref?: string | null
  linkLabel?: string | null
  variant: PickupNoticeVariant
}) {
  return getPrisma().pickupNotice.create({
    data: {
      content: input.content,
      dismissable: input.dismissable,
      enabled: input.enabled,
      linkHref: input.linkHref ?? null,
      linkLabel: input.linkLabel ?? null,
      variant: input.variant,
    },
  })
}

export async function updatePickupNotice(
  id: string,
  input: {
    content: string
    dismissable: boolean
    enabled: boolean
    linkHref?: string | null
    linkLabel?: string | null
    variant: PickupNoticeVariant
  }
) {
  return getPrisma().pickupNotice.update({
    where: {
      id,
    },
    data: {
      content: input.content,
      dismissable: input.dismissable,
      enabled: input.enabled,
      linkHref: input.linkHref ?? null,
      linkLabel: input.linkLabel ?? null,
      variant: input.variant,
    },
  })
}
