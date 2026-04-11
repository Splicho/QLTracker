import 'dotenv/config';

import { parseEnv } from '@qltracker/config';
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
    DATABASE_URL: z.string().url().optional(),
    INTERNAL_WEBHOOK_PORT: z.coerce.number().int().positive().default(8788),
    PUBLIC_APP_URL: z.string().url().optional(),
    PICKUP_QUEUE_ALERTS_CHANNEL_ID: z.string().min(1).optional(),
    PICKUP_QUEUE_ALERTS_ROLE_ID: z.string().min(1).optional(),
    PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET: z.string().min(16).optional(),
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

    const hasPublicAppUrl = Boolean(value.PUBLIC_APP_URL);
    const hasQueueAlertsChannelId = Boolean(value.PICKUP_QUEUE_ALERTS_CHANNEL_ID);
    const hasQueueAlertsSecret = Boolean(value.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET);

    if (!hasPublicAppUrl && !hasQueueAlertsChannelId && !hasQueueAlertsSecret) {
      return;
    }

    if (!hasSecondaryToken) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DISCORD_SECONDARY_TOKEN'],
        message: 'DISCORD_SECONDARY_TOKEN is required when pickup queue alerts are enabled'
      });
    }

    if (!hasSecondaryClientId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DISCORD_SECONDARY_CLIENT_ID'],
        message: 'DISCORD_SECONDARY_CLIENT_ID is required when pickup queue alerts are enabled'
      });
    }

    if (!hasQueueAlertsChannelId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PICKUP_QUEUE_ALERTS_CHANNEL_ID'],
        message: 'PICKUP_QUEUE_ALERTS_CHANNEL_ID is required when pickup queue alerts are enabled'
      });
    }

    if (!hasQueueAlertsSecret) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET'],
        message: 'PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET is required when pickup queue alerts are enabled'
      });
    }

    if (!hasPublicAppUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PUBLIC_APP_URL'],
        message: 'PUBLIC_APP_URL is required when pickup queue alerts are enabled'
      });
    }
  });

export const env = parseEnv(envSchema);
