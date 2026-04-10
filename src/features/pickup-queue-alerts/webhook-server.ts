import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from 'discord.js';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

import type { BotDefinition } from '../../bots/types.js';

const PICKUP_QUEUE_ALERTS_PATH = '/internal/pickup/queue-opened';
const PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER = 'x-qltracker-signature';
const MAX_BODY_SIZE_BYTES = 64 * 1024;

const queueOpenedPayloadSchema = z.object({
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
  type: z.literal('pickup.queue_opened'),
});

type BotRuntime = {
  readonly bot: BotDefinition;
  readonly client: Client;
};

function createSignature(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

function hasValidSignature(body: string, signatureHeader: string | undefined): boolean {
  if (!signatureHeader) {
    return false;
  }

  const expected = Buffer.from(createSignature(env.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET ?? '', body));
  const actual = Buffer.from(signatureHeader);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function postQueueOpenedAlert(
  client: Client,
  payload: z.infer<typeof queueOpenedPayloadSchema>,
): Promise<void> {
  const channel = await client.channels.fetch(env.PICKUP_QUEUE_ALERTS_CHANNEL_ID ?? '');

  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    throw new Error('Configured pickup queue alerts channel is not a sendable text channel.');
  }

  const sendableChannel = channel as typeof channel & {
    send: (options: {
      allowedMentions: { parse: string[]; roles?: string[] };
      content?: string;
      embeds: EmbedBuilder[];
    }) => Promise<unknown>;
  };

  const embed = new EmbedBuilder()
    .setColor(0xff5c58)
    .setTitle(`${payload.queue.name} queue is now open`)
    .setDescription(`${payload.player.personaName} joined the queue.`)
    .setTimestamp(new Date(payload.joinedAt))
    .addFields(
      {
        name: 'Queue',
        value: payload.queue.name,
        inline: true,
      },
      {
        name: 'Status',
        value: `${payload.currentPlayers}/${payload.queue.playerCount}`,
        inline: true,
      },
      {
        name: 'Format',
        value: `${payload.queue.teamSize}v${payload.queue.teamSize}`,
        inline: true,
      },
    )
    .setFooter({
      text: 'QLTracker Pickup',
    });

  if (payload.player.avatarUrl) {
    embed.setAuthor({
      name: payload.player.personaName,
      iconURL: payload.player.avatarUrl,
      ...(payload.player.profileUrl ? { url: payload.player.profileUrl } : {}),
    });
  }

  const messagePayload: {
    allowedMentions: { parse: string[]; roles?: string[] };
    components: ActionRowBuilder<ButtonBuilder>[];
    content?: string;
    embeds: EmbedBuilder[];
  } = {
    allowedMentions: env.PICKUP_QUEUE_ALERTS_ROLE_ID
      ? { parse: [], roles: [env.PICKUP_QUEUE_ALERTS_ROLE_ID] }
      : { parse: [] },
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('Join queue')
          .setStyle(ButtonStyle.Link)
          .setURL(new URL('/pickup', env.PUBLIC_APP_URL).toString()),
      ),
    ],
    embeds: [embed],
  };

  if (env.PICKUP_QUEUE_ALERTS_ROLE_ID) {
    messagePayload.content = `<@&${env.PICKUP_QUEUE_ALERTS_ROLE_ID}>`;
  }

  await sendableChannel.send(messagePayload);
}

export function startPickupQueueAlertsWebhook(runtimes: readonly BotRuntime[]): HttpServer | null {
  if (!env.PICKUP_QUEUE_ALERTS_CHANNEL_ID || !env.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET) {
    return null;
  }

  const secondaryRuntime = runtimes.find((runtime) => runtime.bot.id === 'secondary');

  if (!secondaryRuntime) {
    logger.warn('Pickup queue alerts are configured, but no secondary bot runtime is available');
    return null;
  }

  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== PICKUP_QUEUE_ALERTS_PATH) {
      response.writeHead(404).end('Not found');
      return;
    }

    let rawBody = '';
    let bodyTooLarge = false;

    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      rawBody += chunk;

      if (rawBody.length > MAX_BODY_SIZE_BYTES) {
        bodyTooLarge = true;
        request.destroy();
      }
    });

    request.on('close', () => {
      if (!bodyTooLarge) {
        return;
      }

      if (!response.headersSent) {
        response.writeHead(413).end('Payload too large');
      }
    });

    request.on('end', () => {
      if (bodyTooLarge) {
        return;
      }

      const signatureHeader = Array.isArray(request.headers[PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER])
        ? request.headers[PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER][0]
        : request.headers[PICKUP_QUEUE_ALERTS_SIGNATURE_HEADER];

      if (!hasValidSignature(rawBody, signatureHeader)) {
        response.writeHead(401).end('Invalid signature');
        return;
      }

      let parsedPayload: z.infer<typeof queueOpenedPayloadSchema>;

      try {
        parsedPayload = queueOpenedPayloadSchema.parse(JSON.parse(rawBody));
      } catch (error) {
        logger.warn({ err: error }, 'Rejected invalid pickup queue alert payload');
        response.writeHead(400).end('Invalid payload');
        return;
      }

      void postQueueOpenedAlert(secondaryRuntime.client, parsedPayload)
        .then(() => {
          response.writeHead(204).end();
        })
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Failed to post pickup queue alert to Discord');
          response.writeHead(500).end('Failed to post alert');
        });
    });

    request.on('error', (error) => {
      logger.warn({ err: error }, 'Pickup queue alert webhook request failed');

      if (!response.headersSent) {
        response.writeHead(400).end('Request error');
      }
    });
  });

  server.listen(env.INTERNAL_WEBHOOK_PORT, () => {
    logger.info(
      {
        botId: secondaryRuntime.bot.id,
        channelId: env.PICKUP_QUEUE_ALERTS_CHANNEL_ID,
        port: env.INTERNAL_WEBHOOK_PORT,
      },
      'Pickup queue alerts webhook is listening',
    );
  });

  return server;
}
