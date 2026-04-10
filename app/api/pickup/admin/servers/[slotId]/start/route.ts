import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { adminStartManualSlot } from "@/lib/server/provisioner"

const bodySchema = z.object({
  map: z.string().trim().min(1, "Map name is required."),
  teamSize: z.number().int().min(1).max(8).default(4),
})

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const { slotId } = await params
    const body = bodySchema.parse(await request.json())
    const result = await adminStartManualSlot(
      Number(slotId),
      body.map,
      body.teamSize
    )

    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, "Could not start server.")
  }
}
