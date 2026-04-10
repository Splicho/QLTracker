import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { sendSlotCommand } from "@/lib/server/provisioner"

const bodySchema = z.object({
  action: z.enum(["kick", "ban", "say", "cmd"]),
  target: z.string().optional(),
  message: z.string().optional(),
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
    const result = await sendSlotCommand(
      Number(slotId),
      body.action,
      body.target,
      body.message
    )

    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error, "Could not execute command.")
  }
}
