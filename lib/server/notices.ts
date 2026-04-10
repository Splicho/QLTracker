import type { PickupNotice, PickupNoticeVariant } from "@prisma/client";

import { getPrisma } from "@/lib/server/prisma";

export type PickupNoticeDto = {
  content: string;
  createdAt: string;
  dismissable: boolean;
  enabled: boolean;
  id: string;
  linkHref: string | null;
  linkLabel: string | null;
  updatedAt: string;
  variant: PickupNoticeVariant;
};

export type PublicPickupNoticeDto = {
  content: string;
  dismissable: boolean;
  id: string;
  linkHref: string | null;
  linkLabel: string | null;
  variant: PickupNoticeVariant;
};

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
  };
}

export function toPublicPickupNoticeDto(
  notice: PickupNotice,
): PublicPickupNoticeDto {
  return {
    content: notice.content,
    dismissable: notice.dismissable,
    id: notice.id,
    linkHref: notice.linkHref ?? null,
    linkLabel: notice.linkLabel ?? null,
    variant: notice.variant,
  };
}

export async function listPickupNoticeDtos() {
  const notices = await getPrisma().pickupNotice.findMany({
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return notices.map(toPickupNoticeDto);
}

export async function listPublicPickupNoticeDtos() {
  const notices = await getPrisma().pickupNotice.findMany({
    where: {
      enabled: true,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  });

  return notices.map(toPublicPickupNoticeDto);
}

export async function createPickupNotice(input: {
  content: string;
  dismissable: boolean;
  enabled: boolean;
  linkHref?: string | null;
  linkLabel?: string | null;
  variant: PickupNoticeVariant;
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
  });
}

export async function updatePickupNotice(
  id: string,
  input: {
    content: string;
    dismissable: boolean;
    enabled: boolean;
    linkHref?: string | null;
    linkLabel?: string | null;
    variant: PickupNoticeVariant;
  },
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
  });
}
