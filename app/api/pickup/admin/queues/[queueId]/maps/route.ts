import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import { toPickupMapPoolDto } from "@/lib/server/pickup";
import { getPrisma } from "@/lib/server/prisma";

const paramsSchema = z.object({
  queueId: z.string().min(1),
});

const bodySchema = z.object({
  maps: z.array(
    z.object({
      active: z.boolean().optional().default(true),
      label: z.string().trim().min(1).max(120),
      mapKey: z.string().trim().min(1).max(120),
      sortOrder: z.number().int().min(0).optional(),
    }),
  ),
});

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ queueId: string }> },
) {
  try {
    await requirePickupAdminSession(request);
    const params = paramsSchema.parse(await context.params);
    const body = bodySchema.parse(await request.json());
    const prisma = getPrisma();
    const normalizedMaps = body.maps.map((map, index) => ({
      active: map.active ?? true,
      label: map.label,
      mapKey: map.mapKey,
      sortOrder: map.sortOrder ?? index,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.pickupMapPool.deleteMany({
        where: {
          queueId: params.queueId,
        },
      });

      if (normalizedMaps.length > 0) {
        await tx.pickupMapPool.createMany({
          data: normalizedMaps.map((map) => ({
            ...map,
            queueId: params.queueId,
          })),
        });
      }
    });

    const maps = await prisma.pickupMapPool.findMany({
      where: {
        queueId: params.queueId,
      },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({
      maps: maps.map(toPickupMapPoolDto),
    });
  } catch (error) {
    return handleRouteError(error, "Pickup map pool could not be saved.");
  }
}
