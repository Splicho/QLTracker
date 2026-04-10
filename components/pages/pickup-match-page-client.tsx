"use client";

import { PickupMatchPage } from "@/components/pages/pickup-match-page";
import type { PickupMatchDetail } from "@/lib/pickup";

export function PickupMatchPageClient({
  initialData,
  matchId,
}: {
  initialData?: PickupMatchDetail;
  matchId: string | null;
}) {
  return <PickupMatchPage initialData={initialData} matchId={matchId} />;
}
