import { PickupAdminDashboard } from "@/components/pickup-admin-dashboard"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"
import { getPickupAdminOverview } from "@/lib/server/pickup"

export default async function AdminPage() {
  const session = (await getPickupBrowserSession())!

  return (
    <PickupAdminDashboard
      initialOverview={await getPickupAdminOverview(session.player)}
    />
  )
}
