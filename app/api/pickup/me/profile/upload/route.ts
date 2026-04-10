import { NextResponse } from "next/server";

import { handleRouteError, routeError } from "@/lib/server/errors";
import { requirePickupAppSession } from "@/lib/server/pickup-auth";
import { uploadPickupProfileImageToR2 } from "@/lib/server/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requirePickupAppSession(request);
    const formData = await request.formData();
    const kindValue = formData.get("kind");
    const fileValue = formData.get("file");

    if (kindValue !== "avatar" && kindValue !== "cover") {
      routeError(400, "Upload kind must be avatar or cover.");
    }

    if (!(fileValue instanceof File)) {
      routeError(400, "Image file is required.");
    }

    const uploaded = await uploadPickupProfileImageToR2({
      file: fileValue,
      kind: kindValue,
      personaName: session.player.personaName,
      playerId: session.player.id,
    });

    return NextResponse.json(uploaded);
  } catch (error) {
    return handleRouteError(error, "Pickup profile image upload failed.");
  }
}
