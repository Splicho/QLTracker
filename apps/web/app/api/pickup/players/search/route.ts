import { NextResponse } from "next/server"

import { handleRouteError } from "@/lib/server/errors"
import { requirePickupAppSession } from "@/lib/server/pickup-auth"
import {
  searchPickupPlayersForSubstitute,
  toPickupPlayerDto,
} from "@/lib/server/pickup"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const session = await requirePickupAppSession(request)
    const url = new URL(request.url)
    const query = url.searchParams.get("q")?.trim() ?? ""

    const players = query
      ? await searchPickupPlayersForSubstitute(query, session.player.id)
      : []

    return NextResponse.json({
      players: players.map(toPickupPlayerDto),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup player search failed.")
  }
}
