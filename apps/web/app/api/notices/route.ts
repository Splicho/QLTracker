import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { listPublicPickupNoticeDtos } from "@/lib/server/notices"

export const runtime = "nodejs"

export async function GET() {
  try {
    return NextResponse.json({
      notices: await listPublicPickupNoticeDtos(),
    })
  } catch (error) {
    return handleRouteError(error, "Notices could not be loaded.")
  }
}
