import { redirect } from "next/navigation"

import { PickupAdminSettings } from "@/components/pickup-admin-settings"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"
import { getPickupAdminSettings } from "@/lib/server/pickup"

export default async function AdminSettingsPage() {
  const session = await getPickupBrowserSession()

  if (!session) {
    redirect("/admin/login")
  }

  return (
    <PickupAdminSettings
      initialSettings={await getPickupAdminSettings(session.player)}
    />
  )
}
