import { PickupAdminLocks } from "@/components/pickup-admin-locks"
import { getPickupAdminLocks } from "@/lib/server/pickup"
import { getPickupBrowserSession } from "@/lib/server/pickup-auth"

export default async function AdminLocksPage() {
  const session = await getPickupBrowserSession()

  if (!session) {
    return null
  }

  return (
    <PickupAdminLocks
      initialLocks={await getPickupAdminLocks(session.player)}
    />
  )
}
