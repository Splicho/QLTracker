import { PickupAdminRanks } from "@/components/pickup-admin-ranks"
import { getPickupAdminOverview } from "@/lib/server/pickup"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"

export default async function AdminRanksPage() {
  const session = await getPickupBrowserSession()

  if (!session) {
    return null
  }

  return (
    <PickupAdminRanks
      initialOverview={await getPickupAdminOverview(session.player)}
    />
  )
}
