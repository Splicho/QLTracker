import { z } from "zod";

export const pickupCallbackSignatureHeader = "x-pickup-signature";
export const pickupQueueAlertsPath = "/internal/pickup/queue-opened";
export const pickupQueueAlertsSignatureHeader = "x-qltracker-signature";

export const pickupPlayerSchema = z.object({
  avatarUrl: z.string().url().nullable().optional(),
  id: z.string().min(1),
  personaName: z.string().min(1),
  playerId: z.string().min(1).optional(),
  profileUrl: z.string().url().nullable().optional(),
  steamId: z.string().min(1),
  team: z.string().min(1).optional(),
});

export const pickupProvisionPlayerSchema = z.object({
  displayRating: z.number().int().nonnegative().optional(),
  personaName: z.string().min(1),
  playerId: z.string().min(1),
  steamId: z.string().min(1),
});

export const pickupProvisionQueueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  playerCount: z.number().int().positive(),
  slug: z.string().min(1),
  teamSize: z.number().int().positive(),
});

export const pickupProvisionPayloadSchema = z.object({
  captains: z
    .object({
      left: z.string().min(1),
      right: z.string().min(1),
    })
    .nullable(),
  finalMapKey: z.string().min(1),
  queue: pickupProvisionQueueSchema.optional(),
  matchId: z.string().min(1),
  queueId: z.string().min(1),
  seasonId: z.string().min(1),
  teams: z.object({
    left: z.array(pickupProvisionPlayerSchema).min(1),
    right: z.array(pickupProvisionPlayerSchema).min(1),
  }),
});

export const pickupStatsRelayEventSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  eventAt: z.string().datetime().nullable().optional().default(null),
  eventIndex: z.number().int().nonnegative(),
  source: z.string().min(1).default("zmq"),
  type: z.string().min(1),
});

export const pickupStatsRelayPayloadSchema = z.object({
  events: z.array(pickupStatsRelayEventSchema).min(1),
  matchId: z.string().min(1),
  slotId: z.number().int().positive().optional(),
});

export const pickupQueueAlertPayloadSchema = z.object({
  action: z.enum(["opened", "joined"]),
  currentPlayers: z.number().int().nonnegative(),
  joinedAt: z.string().datetime(),
  player: z.object({
    avatarUrl: z.string().url().nullable(),
    id: z.string().min(1),
    personaName: z.string().min(1),
    profileUrl: z.string().url().nullable(),
    steamId: z.string().min(1),
  }),
  queue: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    playerCount: z.number().int().positive(),
    slug: z.string().min(1),
    teamSize: z.number().int().positive(),
  }),
  type: z.literal("pickup.queue_opened"),
});

export const pickupMatchReportPlayerSchema = z.object({
  avatarUrl: z.string().url().nullable(),
  displayAfter: z.number().int().nonnegative().nullable().optional(),
  displayBefore: z.number().int().nonnegative().nullable().optional(),
  id: z.string().min(1),
  personaName: z.string().min(1),
  profileUrl: z.string().url().nullable(),
  steamId: z.string().min(1),
  won: z.boolean().nullable().optional(),
});

export const pickupMatchReportPayloadSchema = z.object({
  completedAt: z.string().datetime(),
  finalMapKey: z.string().min(1).nullable(),
  finalScore: z.string().min(1).nullable(),
  matchId: z.string().min(1),
  queue: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    playerCount: z.number().int().positive(),
    slug: z.string().min(1),
    teamSize: z.number().int().positive(),
  }),
  teams: z.object({
    left: z.array(pickupMatchReportPlayerSchema),
    right: z.array(pickupMatchReportPlayerSchema),
  }),
  type: z.literal("pickup.match_report"),
  winnerTeam: z.enum(["left", "right"]),
});

export const pickupDiscordWebhookPayloadSchema = z.discriminatedUnion("type", [
  pickupQueueAlertPayloadSchema,
  pickupMatchReportPayloadSchema,
]);

export type PickupProvisionPayload = z.infer<typeof pickupProvisionPayloadSchema>;
export type PickupDiscordWebhookPayload = z.infer<typeof pickupDiscordWebhookPayloadSchema>;
export type PickupMatchReportPayload = z.infer<typeof pickupMatchReportPayloadSchema>;
export type PickupQueueAlertPayload = z.infer<typeof pickupQueueAlertPayloadSchema>;
export type PickupStatsRelayEvent = z.infer<typeof pickupStatsRelayEventSchema>;
export type PickupStatsRelayPayload = z.infer<typeof pickupStatsRelayPayloadSchema>;
