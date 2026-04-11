import { NextResponse } from "next/server"

import { handleRouteError, routeError } from "@/lib/server/errors"
import { requirePickupAdminSession } from "@/lib/server/pickup-auth"
import { uploadNewsImageToR2 } from "@/lib/server/r2"

export const runtime = "nodejs"

export async function POST(request: Request) {
  try {
    await requirePickupAdminSession(request)

    const formData = await request.formData()
    const kindValue = formData.get("kind")
    const titleValue = formData.get("title")
    const fileValue = formData.get("file")

    if (kindValue !== "cover" && kindValue !== "content") {
      routeError(400, "Upload kind must be cover or content.")
    }

    if (typeof titleValue !== "string" || titleValue.trim().length === 0) {
      routeError(400, "Article title is required before uploading images.")
    }

    if (!(fileValue instanceof File)) {
      routeError(400, "Image file is required.")
    }

    const uploaded = await uploadNewsImageToR2({
      file: fileValue,
      kind: kindValue,
      title: titleValue,
    })

    return NextResponse.json(uploaded)
  } catch (error) {
    return handleRouteError(error, "Image upload failed.")
  }
}
