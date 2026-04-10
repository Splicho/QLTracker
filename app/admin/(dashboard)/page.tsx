import { PickupAdminDashboard } from "@/components/pickup-admin-dashboard"
import { redirect } from "next/navigation"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"
import { getPickupAdminOverview } from "@/lib/server/pickup"

export default async function AdminPage() {
  const session = await getPickupBrowserSession()

  if (!session) {
    redirect("/admin/login")
  }

  return (
    <PickupAdminDashboard
      initialOverview={await getPickupAdminOverview(session.player)}
    />
  )
}
