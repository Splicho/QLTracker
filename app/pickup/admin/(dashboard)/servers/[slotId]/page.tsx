import { redirect } from "next/navigation";

export default async function PickupAdminSlotDetailPage({
  params,
}: {
  params: Promise<{ slotId: string }>;
}) {
  const { slotId } = await params;
  redirect(`/admin/servers/${slotId}`);
}
