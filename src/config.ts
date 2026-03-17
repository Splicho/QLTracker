import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3011),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGIN: z.string().default("*"),
  GEOLITE_COUNTRY_DB_PATH: z.string().default("GeoLite2-Country.mmdb"),
  HISTORY_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  HISTORY_SAMPLE_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  QLSTATS_API_URL: z.string().default("https://qlstats.net/api"),
  REALTIME_INGEST_TOKEN: z.string().min(1, "REALTIME_INGEST_TOKEN is required"),
  STEAM_API_KEY: z.string().optional(),
  STEAM_APP_ID: z.string().default("282440"),
  STEAM_SERVER_LIMIT: z.coerce.number().int().positive().default(500),
  TRUESKILL_URL_TEMPLATE: z
    .string()
    .default("http://qlrelax.freemyip.com/elo/bn/%s"),
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
  pollIntervalMs: parsedEnv.POLL_INTERVAL_MS,
  port: parsedEnv.PORT,
  qlstatsApiUrl: parsedEnv.QLSTATS_API_URL.trim().replace(/\/+$/, ""),
  steamApiKey: parsedEnv.STEAM_API_KEY?.trim() ?? "",
  steamAppId: parsedEnv.STEAM_APP_ID.trim() || "282440",
  steamServerLimit: parsedEnv.STEAM_SERVER_LIMIT,
  trueskillUrlTemplate: parsedEnv.TRUESKILL_URL_TEMPLATE.trim(),
};
