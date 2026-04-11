import {
  pickupProvisionPayloadSchema,
  type PickupProvisionPayload,
} from "@qltracker/contracts";

export const provisionPayloadSchema = pickupProvisionPayloadSchema;

export type ProvisionPayload = PickupProvisionPayload;

export type SlotStatus = "busy" | "idle" | "provisioning";

export type SlotState = {
  gamePort: number;
  joinAddress: string;
  matchId: string | null;
  queueId: string | null;
  rconPort: number | null;
  rconToken: string | null;
  redisDb: number;
  resultPostedAt: string | null;
  slotId: number;
  state: SlotStatus;
  token: string | null;
  updatedAt: string;
  zmqPort: number;
};

export type SlotMetadataPlayer = {
  displayRating?: number;
  personaName: string;
  playerId: string;
  steamId: string;
};

export type SlotMetadata = {
  callbackBaseUrl: string;
  callbackToken: string;
  captains: ProvisionPayload["captains"];
  finalMapKey: string;
  matchId: string;
  queue?: ProvisionPayload["queue"];
  queueId: string;
  seasonId: string;
  slotId: number;
  teams: {
    blue: SlotMetadataPlayer[];
    red: SlotMetadataPlayer[];
  };
};
