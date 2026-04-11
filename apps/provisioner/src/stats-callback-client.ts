import {
  pickupCallbackSignatureHeader,
  type PickupStatsRelayEvent,
  type PickupStatsRelayPayload,
} from "@qltracker/contracts";
import { config } from "./config.js";
import { createSignature } from "./signing.js";

export async function postPickupStatsEvents(input: {
  events: PickupStatsRelayEvent[];
  matchId: string;
  slotId: number;
}) {
  const payload: PickupStatsRelayPayload = input;
  const rawBody = JSON.stringify(payload);
  const response = await fetch(config.realtimeStatsCallbackUrl, {
    body: rawBody,
    headers: {
      "Content-Type": "application/json",
      [pickupCallbackSignatureHeader]: createSignature(
        config.callbackSecret,
        rawBody,
      ),
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
