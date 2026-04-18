import { NextResponse } from "next/server"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { getPrisma } from "@/lib/server/prisma"
import { uploadPickupRankBadgeToR2 } from "@/lib/server/r2"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request)

    const formData = await request.formData()
    const queueIdValue = formData.get("queueId")
    const titleValue = formData.get("title")
    const fileValue = formData.get("file")

    if (typeof queueIdValue !== "string" || queueIdValue.trim().length === 0) {
      routeError(400, "Pickup queue is required before uploading rank badges.")
    }

    if (typeof titleValue !== "string" || titleValue.trim().length === 0) {
      routeError(400, "Rank title is required before uploading a badge.")
    }

    if (!(fileValue instanceof File)) {
      routeError(400, "Rank badge image file is required.")
    }

    const prisma = getPrisma()
    const queue = await prisma.pickupQueue.findUnique({
      where: {
        id: queueIdValue,
      },
      select: {
        id: true,
      },
    })

    if (!queue) {
      routeError(404, "Pickup queue not found.")
    }

    const uploaded = await uploadPickupRankBadgeToR2({
      file: fileValue,
      queueId: queueIdValue,
      title: titleValue,
    })

    return NextResponse.json(uploaded)
  } catch (error) {
    return handleRouteError(error, "Rank badge upload failed.")
  }
}
