import { z } from "zod"

const envSchema = z.object({
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  STEAM_API_KEY: z.string().min(1),
  QLSTATS_API_URL: z.string().url().default("https://qlstats.net/api"),
  PICKUP_ADMIN_STEAM_IDS: z.string().default(""),
  PICKUP_AUTH_COOKIE_NAME: z.string().default("qltracker-pickup-session"),
  /** If empty, derived from PUBLIC_BASE_URL (www + apex share e.g. qltracker.com). */
  PICKUP_AUTH_COOKIE_DOMAIN: z.string().default(""),
  /** Set to "1" in production to log pickup auth / Steam callback diagnostics (no secrets). */
  PICKUP_AUTH_DEBUG: z.string().default(""),
  SESSION_SECRET: z.string().min(16),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
})

export type ServerEnv = z.infer<typeof envSchema>

let cachedEnv: ServerEnv | null = null

export function getNotificationEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env)
  }

  return cachedEnv
}

export function getPickupAdminSteamIds() {
  return getNotificationEnv()
    .PICKUP_ADMIN_STEAM_IDS.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}
