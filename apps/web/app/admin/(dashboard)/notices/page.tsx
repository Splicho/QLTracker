import { PickupAdminNotices } from "@/components/pickup-admin-notices"
import { listPickupNoticeDtos } from "@/lib/server/notices"

export default async function AdminNoticesPage() {
  return <PickupAdminNotices initialNotices={await listPickupNoticeDtos()} />
}
