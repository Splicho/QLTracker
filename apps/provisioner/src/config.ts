import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  CALLBACK_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(7070),
  POST_MATCH_GRACE_SECONDS: z.coerce.number().int().positive().default(45),
  PROVISION_AUTH_TOKEN: z.string().min(1),
  PROVISION_READY_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  PUBLIC_COUNTRY_CODE: z.string().trim().max(2).default(""),
  PUBLIC_COUNTRY_NAME: z.string().trim().default(""),
  PUBLIC_HOST: z.string().min(1).default("provision.qltracker.com"),
  PUBLIC_IP: z.string().min(1),
  QLDS_BASE_DIR: z.string().min(1).default("/opt/qltracker-qlds"),
  QLX_OWNER_STEAM_ID: z.string().min(1),
  REALTIME_LIVE_CALLBACK_URL: z.string().url(),
  REALTIME_RESULT_CALLBACK_URL: z.string().url(),
  REALTIME_STATS_CALLBACK_URL: z.string().url(),
  SLOTS_DIR: z.string().min(1).default("/var/lib/qltracker-provisioner/slots"),
  ZMQ_STATS_PASSWORD: z.string().trim().default(""),
});

const parsed = envSchema.parse(process.env);
const normalizedPublicCountryCode = parsed.PUBLIC_COUNTRY_CODE.trim().toLowerCase();
const normalizedPublicCountryName = parsed.PUBLIC_COUNTRY_NAME.trim();
const normalizedZmqStatsPassword = parsed.ZMQ_STATS_PASSWORD.trim();

export const config = {
  callbackSecret: parsed.CALLBACK_SECRET,
  port: parsed.PORT,
  postMatchGraceSeconds: parsed.POST_MATCH_GRACE_SECONDS,
  provisionAuthToken: parsed.PROVISION_AUTH_TOKEN,
  provisionReadyTimeoutMs: parsed.PROVISION_READY_TIMEOUT_MS,
  publicCountryCode:
    normalizedPublicCountryCode.length === 2 ? normalizedPublicCountryCode : null,
  publicCountryName:
    normalizedPublicCountryName.length > 0 ? normalizedPublicCountryName : null,
  publicHost: parsed.PUBLIC_HOST,
  publicIp: parsed.PUBLIC_IP,
  qldsBaseDir: parsed.QLDS_BASE_DIR,
  qlxOwnerSteamId: parsed.QLX_OWNER_STEAM_ID,
  realtimeLiveCallbackUrl: parsed.REALTIME_LIVE_CALLBACK_URL,
  realtimeResultCallbackUrl: parsed.REALTIME_RESULT_CALLBACK_URL,
  realtimeStatsCallbackUrl: parsed.REALTIME_STATS_CALLBACK_URL,
  slotsDir: parsed.SLOTS_DIR,
  zmqStatsPassword:
    normalizedZmqStatsPassword.length > 0 ? normalizedZmqStatsPassword : null,
};

export type SlotDefinition = {
  gamePort: number;
  id: number;
  redisDb: number;
  zmqPort: number;
};

export const SLOT_DEFINITIONS: SlotDefinition[] = [
  { id: 1, gamePort: 27961, redisDb: 1, zmqPort: 64550 },
  { id: 2, gamePort: 27962, redisDb: 2, zmqPort: 64551 },
  { id: 3, gamePort: 27963, redisDb: 3, zmqPort: 64552 },
  { id: 4, gamePort: 27964, redisDb: 4, zmqPort: 64553 },
];

export function ensureAppDirectories() {
  fs.mkdirSync(config.slotsDir, { recursive: true });
  for (const slot of SLOT_DEFINITIONS) {
    const slotDir = path.join(config.slotsDir, `slot-${slot.id}`);
    fs.mkdirSync(slotDir, { recursive: true });
    fs.mkdirSync(path.join(slotDir, "home"), { recursive: true });
    fs.mkdirSync(path.join(slotDir, "home", "baseq3"), { recursive: true });
    fs.mkdirSync(path.join(slotDir, "logs"), { recursive: true });
  }
}
