import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { getSlotEvents } from "@/lib/server/provisioner"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slotId: string }> }
) {
  try {
    await requirePickupAdminSession(request)
    const { slotId } = await params
    const url = new URL(request.url)
    const since = url.searchParams.get("since") ?? undefined
    const data = await getSlotEvents(Number(slotId), since)

    return NextResponse.json(data)
  } catch (error) {
    return handleRouteError(error, "Could not fetch slot events.")
  }
}
