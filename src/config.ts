import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3011),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("*"),
  GEOLITE_COUNTRY_DB_PATH: z.string().default("GeoLite2-Country.mmdb"),
  HISTORY_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  HISTORY_SAMPLE_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  PICKUP_QUEUE_DISCONNECT_GRACE_MS: z.coerce.number().int().positive().default(15000),
  PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET: z.string().optional(),
  PICKUP_QUEUE_ALERTS_WEBHOOK_URL: z.string().url().optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  QLSTATS_API_URL: z.string().default("https://qlstats.net/api"),
  REALTIME_INGEST_TOKEN: z.string().min(1, "REALTIME_INGEST_TOKEN is required"),
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET is required"),
  STEAM_API_KEY: z.string().optional(),
  STEAM_APP_ID: z.string().default("282440"),
  STEAM_SERVER_LIMIT: z.coerce.number().int().positive().default(500),
  TRUESKILL_URL_TEMPLATE: z
    .string()
    .default("http://qlrelax.freemyip.com/elo/bn/%s"),
}).superRefine((value, context) => {
  const hasAlertsUrl = Boolean(value.PICKUP_QUEUE_ALERTS_WEBHOOK_URL);
  const hasAlertsSecret = Boolean(value.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET);

  if (!hasAlertsUrl && !hasAlertsSecret) {
    return;
  }

  if (!hasAlertsUrl) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PICKUP_QUEUE_ALERTS_WEBHOOK_URL"],
      message: "PICKUP_QUEUE_ALERTS_WEBHOOK_URL is required when queue alerts are enabled",
    });
  }

  if (!hasAlertsSecret) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET"],
      message: "PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET is required when queue alerts are enabled",
    });
  }
});

const parsedEnv = envSchema.parse(process.env);

export const config = {
  corsOrigins:
    parsedEnv.CORS_ORIGIN.trim() === "*"
      ? "*"
      : parsedEnv.CORS_ORIGIN.split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
  databaseUrl: parsedEnv.DATABASE_URL,
  geoliteCountryDbPath: parsedEnv.GEOLITE_COUNTRY_DB_PATH.trim(),
  historyRetentionDays: parsedEnv.HISTORY_RETENTION_DAYS,
  historySampleIntervalMs: parsedEnv.HISTORY_SAMPLE_INTERVAL_MS,
  ingestToken: parsedEnv.REALTIME_INGEST_TOKEN,
  pickupQueueAlertsWebhookSecret:
    parsedEnv.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET?.trim() ?? "",
  pickupQueueAlertsWebhookUrl:
    parsedEnv.PICKUP_QUEUE_ALERTS_WEBHOOK_URL?.trim().replace(/\/+$/, "") ?? "",
  pickupQueueDisconnectGraceMs: parsedEnv.PICKUP_QUEUE_DISCONNECT_GRACE_MS,
  pollIntervalMs: parsedEnv.POLL_INTERVAL_MS,
  port: parsedEnv.PORT,
  qlstatsApiUrl: parsedEnv.QLSTATS_API_URL.trim().replace(/\/+$/, ""),
  sessionSecret: parsedEnv.SESSION_SECRET,
  steamApiKey: parsedEnv.STEAM_API_KEY?.trim() ?? "",
  steamAppId: parsedEnv.STEAM_APP_ID.trim() || "282440",
  steamServerLimit: parsedEnv.STEAM_SERVER_LIMIT,
  trueskillUrlTemplate: parsedEnv.TRUESKILL_URL_TEMPLATE.trim(),
};
