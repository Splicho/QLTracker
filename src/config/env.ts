import 'dotenv/config';

import { z } from 'zod';

const envSchema = z
  .object({
    DISCORD_PRIMARY_TOKEN: z.string().min(1, 'DISCORD_PRIMARY_TOKEN is required'),
    DISCORD_PRIMARY_CLIENT_ID: z.string().min(1, 'DISCORD_PRIMARY_CLIENT_ID is required'),
    DISCORD_PRIMARY_GUILD_ID: z.string().min(1).optional(),
    DISCORD_PRIMARY_NAME: z.string().min(1).default('primary'),
    DISCORD_SECONDARY_TOKEN: z.string().min(1).optional(),
    DISCORD_SECONDARY_CLIENT_ID: z.string().min(1).optional(),
    DISCORD_SECONDARY_GUILD_ID: z.string().min(1).optional(),
    DISCORD_SECONDARY_NAME: z.string().min(1).default('secondary'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info')
  })
  .superRefine((value, context) => {
    const hasSecondaryToken = Boolean(value.DISCORD_SECONDARY_TOKEN);
    const hasSecondaryClientId = Boolean(value.DISCORD_SECONDARY_CLIENT_ID);
    const hasSecondaryGuildId = Boolean(value.DISCORD_SECONDARY_GUILD_ID);

    if (!hasSecondaryToken && !hasSecondaryClientId && !hasSecondaryGuildId) {
      return;
    }

    if (!hasSecondaryToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DISCORD_SECONDARY_TOKEN'],
        message: 'DISCORD_SECONDARY_TOKEN is required when configuring the secondary bot'
      });
    }

    if (!hasSecondaryClientId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DISCORD_SECONDARY_CLIENT_ID'],
        message: 'DISCORD_SECONDARY_CLIENT_ID is required when configuring the secondary bot'
      });
    }
  });

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const flattenedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('\n');

  throw new Error(`Invalid environment configuration:\n${flattenedErrors}`);
}

export const env = parsedEnv.data;
