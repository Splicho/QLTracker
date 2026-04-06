import { z } from "zod";

export const playerSchema = z.object({
  personaName: z.string().min(1),
  playerId: z.string().min(1),
  steamId: z.string().min(1),
});

export const provisionPayloadSchema = z.object({
  captains: z
    .object({
      left: z.string().min(1),
      right: z.string().min(1),
    })
    .nullable(),
  finalMapKey: z.string().min(1),
  matchId: z.string().min(1),
  queueId: z.string().min(1),
  seasonId: z.string().min(1),
  teams: z.object({
    left: z.array(playerSchema).min(1),
    right: z.array(playerSchema).min(1),
  }),
});

export type ProvisionPayload = z.infer<typeof provisionPayloadSchema>;

export type SlotStatus = "busy" | "idle" | "provisioning";

export type SlotState = {
  gamePort: number;
  matchId: string | null;
  queueId: string | null;
  redisDb: number;
  resultPostedAt: string | null;
  slotId: number;
  state: SlotStatus;
  token: string | null;
  updatedAt: string;
  zmqPort: number;
};

export type SlotMetadata = {
  callbackBaseUrl: string;
  callbackToken: string;
  captains: ProvisionPayload["captains"];
  finalMapKey: string;
  matchId: string;
  queueId: string;
  seasonId: string;
  slotId: number;
  teams: {
    blue: Array<{ personaName: string; playerId: string; steamId: string }>;
    red: Array<{ personaName: string; playerId: string; steamId: string }>;
  };
};
