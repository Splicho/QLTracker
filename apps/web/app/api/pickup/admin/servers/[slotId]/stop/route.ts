import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { adminStopSlot } from "@/lib/server/provisioner"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const { slotId } = await params
    await adminStopSlot(Number(slotId))

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, "Could not stop server.")
  }
}
