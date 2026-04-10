import { PickupAdminSlotDetail } from "@/components/pickup-admin-slot-detail";

export default async function AdminSlotDetailPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;

  return <PickupAdminSlotDetail slotId={Number(slotId)} />;
}
