import { NextResponse } from "next/server"
import { z } from "zod"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { abortRealtimePickupMatch } from "@/lib/server/realtime-admin"
import { adminStopSlot, getProvisionerSlots } from "@/lib/server/provisioner"

export const runtime = "nodejs"

const bodySchema = z.object({
  slotId: z.number().int().positive().optional(),
})

type ProvisionerSlotSnapshot = {
  matchId?: unknown
  slotId?: unknown
  state?: unknown
}

function normalizeSlotId(value: unknown) {
  const slotId = typeof value === "number" ? value : Number(value)
  return Number.isInteger(slotId) && slotId > 0 ? slotId : null
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function stopProvisionerSlotForMatch(
  matchId: string,
  preferredSlotId?: number
) {
  for (let attempt = 0; attempt < 7; attempt += 1) {
    let slots: ProvisionerSlotSnapshot[]
    try {
      slots = (await getProvisionerSlots()) as ProvisionerSlotSnapshot[]
    } catch (error) {
      return {
        slotStopped: false,
        slotStopWarning: `Pickup aborted, but server slot lookup failed: ${formatError(error)}`,
      }
    }

    const matchingSlots = slots.filter((slot) => slot.matchId === matchId)
    const preferredSlot = matchingSlots.find(
      (slot) => normalizeSlotId(slot.slotId) === preferredSlotId
    )
    const slot = preferredSlot ?? matchingSlots[0]
    if (slot) {
      const slotId = normalizeSlotId(slot.slotId)
      if (!slotId) {
        return {
          slotStopped: false,
          slotStopWarning:
            "Pickup aborted, but provisioner returned an invalid slot id.",
        }
      }

      if (slot.state === "idle") {
        return {
          slotId,
          slotStopped: false,
        }
      }

      try {
        await adminStopSlot(slotId)
        return {
          slotId,
          slotStopped: true,
        }
      } catch (error) {
        return {
          slotId,
          slotStopped: false,
          slotStopWarning: `Pickup aborted, but server stop failed: ${formatError(error)}`,
        }
      }
    }

    if (attempt < 6) {
      await wait(750)
    }
  }

  return {
    slotStopped: false,
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = await requirePickupAdminSession(request)
    const { matchId } = await params
    if (!matchId) {
      routeError(400, "matchId is required.")
    }

    const parsedBody = bodySchema.parse(await request.json().catch(() => ({})))
    const abortResult = await abortRealtimePickupMatch(
      matchId,
      session.player.steamId
    )
    const slotResult = abortResult.aborted
      ? await stopProvisionerSlotForMatch(matchId, parsedBody.slotId)
      : { slotStopped: false }

    return NextResponse.json({
      ok: true,
      abort: abortResult,
      ...slotResult,
    })
  } catch (error) {
    return handleRouteError(error, "Could not abort pickup.")
  }
}
