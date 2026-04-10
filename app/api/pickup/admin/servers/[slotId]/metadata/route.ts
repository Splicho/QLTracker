import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import { getSlotMetadata } from "@/lib/server/provisioner";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slotId: string }> },
) {
  try {
    await requirePickupAdminSession(request);
    const { slotId } = await params;
    const metadata = await getSlotMetadata(Number(slotId));

    return NextResponse.json(metadata);
  } catch (error) {
    return handleRouteError(error, "Could not fetch slot metadata.");
  }
}
