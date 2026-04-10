import { NextResponse } from "next/server"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAppSession } from "@/lib/server/pickup-auth"
import {
  getPickupPlayerProfile,
  getPickupPlayerByIdOrSteamId,
  toPickupPlayerDto,
  updatePickupPlayerProfileMedia,
} from "@/lib/server/pickup"
import { deletePickupImagesFromR2 } from "@/lib/server/r2"

export const runtime = "nodejs"

function parseOptionalImageUrl(
  value: unknown,
  label: "Avatar" | "Cover"
): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    routeError(400, `${label} image URL must be a string or null.`)
  }

  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) {
    return null
  }

  try {
    new URL(trimmedValue)
  } catch {
    routeError(400, `${label} image URL must be a valid absolute URL.`)
  }

  return trimmedValue
}

function parseOptionalCountryCode(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (typeof value !== "string") {
    routeError(400, "Country must be a two-letter ISO code or null.")
  }

  const normalizedValue = value.trim().toUpperCase()
  if (normalizedValue.length === 0) {
    return null
  }

  if (!/^[A-Z]{2}$/.test(normalizedValue)) {
    routeError(400, "Country must be a valid two-letter ISO code.")
  }

  return normalizedValue
}

export async function GET(request: Request) {
  try {
    const session = await requirePickupAppSession(request)

    return NextResponse.json({
      profile: await getPickupPlayerProfile(session.player.id),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup profile could not be loaded.")
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requirePickupAppSession(request)
    const payload = (await request.json()) as {
      countryCode?: unknown
      customAvatarUrl?: unknown
      customCoverUrl?: unknown
    }
    const previousPlayer = await getPickupPlayerByIdOrSteamId(session.player.id)

    if (!previousPlayer) {
      routeError(404, "Pickup player could not be found.")
    }

    const updatedPlayer = await updatePickupPlayerProfileMedia(
      session.player.id,
      {
        countryCode: parseOptionalCountryCode(payload.countryCode),
        customAvatarUrl: parseOptionalImageUrl(
          payload.customAvatarUrl,
          "Avatar"
        ),
        customCoverUrl: parseOptionalImageUrl(payload.customCoverUrl, "Cover"),
      }
    )

    const staleImageUrls: string[] = []
    if (
      previousPlayer.customAvatarUrl &&
      previousPlayer.customAvatarUrl !== updatedPlayer.customAvatarUrl
    ) {
      staleImageUrls.push(previousPlayer.customAvatarUrl)
    }

    if (
      previousPlayer.customCoverUrl &&
      previousPlayer.customCoverUrl !== updatedPlayer.customCoverUrl
    ) {
      staleImageUrls.push(previousPlayer.customCoverUrl)
    }

    if (staleImageUrls.length > 0) {
      void deletePickupImagesFromR2(staleImageUrls).catch((error) => {
        console.error(
          "Failed to remove old pickup profile images from R2:",
          error
        )
      })
    }

    return NextResponse.json({
      player: toPickupPlayerDto(updatedPlayer),
    })
  } catch (error) {
    return handleRouteError(error, "Pickup profile could not be updated.")
  }
}
