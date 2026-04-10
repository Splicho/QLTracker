import { PickupAdminSettings } from "@/components/pickup-admin-settings";
import { getPickupBrowserSession } from "@/lib/server/pickup-auth";
import { getPickupAdminSettings } from "@/lib/server/pickup";

export default async function AdminSettingsPage() {
  const session = (await getPickupBrowserSession())!;

  return (
    <PickupAdminSettings
      initialSettings={await getPickupAdminSettings(session.player)}
    />
  );
}
