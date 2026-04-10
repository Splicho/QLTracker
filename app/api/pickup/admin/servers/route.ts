import { NextResponse } from "next/server";

import { handleRouteError } from "@/lib/server/errors";
import { requirePickupAdminSession } from "@/lib/server/pickup-auth";
import { getProvisionerSlots } from "@/lib/server/provisioner";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePickupAdminSession(request);
    const slots = await getProvisionerSlots();

    return NextResponse.json({ ok: true, slots });
  } catch (error) {
    return handleRouteError(error, "Could not fetch server slots.");
  }
}
