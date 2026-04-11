import { NextResponse } from "next/server"

import { performPickupAdminBrowserLogout } from "@/lib/server/pickup-auth"

export const runtime = "nodejs"

/** Logout must be POST so Next.js `<Link prefetch>` never hits GET and revokes the session. */
export async function POST(request: Request) {
  return performPickupAdminBrowserLogout(request)
}

export function GET() {
  return NextResponse.json(
    { message: "Use the Logout button." },
    { status: 405, headers: { Allow: "POST" } }
  )
}
