import { performPickupAdminBrowserLogout } from "@/lib/server/pickup-auth"

export const runtime = "nodejs"

/** Full logout in one hop (avoid chaining to `/admin/logout`, which is POST-only). */
export async function GET(request: Request) {
  return performPickupAdminBrowserLogout(request)
}
