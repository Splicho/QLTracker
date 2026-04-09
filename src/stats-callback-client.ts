import { config } from "./config.js";
import { createSignature } from "./signing.js";

export type PickupStatsRelayEvent = {
  data: Record<string, unknown>;
  eventAt: string;
  eventIndex: number;
  source: string;
  type: string;
};

export async function postPickupStatsEvents(input: {
  events: PickupStatsRelayEvent[];
  matchId: string;
  slotId: number;
}) {
  const rawBody = JSON.stringify(input);
  const response = await fetch(config.realtimeStatsCallbackUrl, {
    body: rawBody,
    headers: {
      "Content-Type": "application/json",
      "x-pickup-signature": createSignature(config.callbackSecret, rawBody),
    },
    method: "POST",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Realtime stats callback failed (${response.status}): ${text}`,
    );
  }
}
