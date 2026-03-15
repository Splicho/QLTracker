import { z } from "zod";

export const serverSnapshotSchema = z.object({
  addr: z.string().min(3),
  steamid: z.string().nullable().optional(),
  countryCode: z.string().nullable().optional(),
  countryName: z.string().nullable().optional(),
  name: z.string().min(1),
  ip: z.string().nullable().optional(),
  map: z.string().min(1),
  appId: z.number().int().positive().optional(),
  bots: z.number().int().nonnegative().optional(),
  connectUrl: z.string().optional(),
  gameDescription: z.string().optional(),
  gameDirectory: z.string().optional(),
  players: z.number().int().nonnegative(),
  maxPlayers: z.number().int().positive(),
  gameMode: z.string().nullable().optional(),
  keywords: z.string().nullable().optional(),
  pingMs: z.number().int().nonnegative().nullable().optional(),
  requiresPassword: z.boolean().nullable().optional(),
  region: z.number().int().nullable().optional(),
  avgQelo: z.number().nullable().optional(),
  avgTrueskill: z.number().nullable().optional(),
  version: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
  playersInfo: z
    .array(
      z.object({
        name: z.string(),
        score: z.number(),
        durationSeconds: z.number(),
        qelo: z.number().nullable().optional(),
        steamId: z.string().nullable().optional(),
        team: z.number().int().nullable().optional(),
        trueskill: z.number().nullable().optional(),
      })
    )
    .default([]),
});

export type ServerSnapshot = z.infer<typeof serverSnapshotSchema>;

export type ServerCountryLocation = {
  addr: string;
  country_code: string | null;
  country_name: string | null;
  ip: string;
};
