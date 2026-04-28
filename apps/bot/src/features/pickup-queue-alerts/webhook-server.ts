import { timingSafeEqual } from 'node:crypto';
import { createSignature } from '@qltracker/crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import {
  pickupDiscordWebhookPayloadSchema,
  pickupQueueAlertsPath,
  pickupQueueAlertsSignatureHeader,
} from '@qltracker/contracts';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
} from 'discord.js';

import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';
import { formatPickupPlayerName } from '../../shared/pickup-player-name.js';

import type { BotDefinition } from '../../bots/types.js';
import type { PickupDiscordWebhookPayload, PickupMatchReportPayload } from '@qltracker/contracts';
const MAX_BODY_SIZE_BYTES = 64 * 1024;

type BotRuntime = {
  readonly bot: BotDefinition;
  readonly client: Client;
};

function getQueueAlertsChannelId() {
  return env.PICKUP_QUEUE_ALERTS_CHANNEL_ID ?? null;
}

function getMatchReportsChannelId() {
  return env.PICKUP_MATCH_REPORTS_CHANNEL_ID ?? env.PICKUP_QUEUE_ALERTS_CHANNEL_ID ?? null;
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
  payload: import('@qltracker/contracts').PickupQueueAlertPayload,
): Promise<void> {
  const channelId = getQueueAlertsChannelId();
  if (!channelId) {
    throw new Error('PICKUP_QUEUE_ALERTS_CHANNEL_ID is not configured.');
  }

  const channel = await client.channels.fetch(channelId);

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

  const isQueueOpened = payload.action === 'opened';
  const embedTitle = isQueueOpened
    ? `${payload.queue.name} queue is now open`
    : `${payload.player.personaName} joined ${payload.queue.name}`;
  const embedDescription = isQueueOpened
    ? `${payload.player.personaName} opened the queue.`
    : `The queue is now ${payload.currentPlayers}/${payload.queue.playerCount}.`;

  const embed = new EmbedBuilder()
    .setColor(0xff5c58)
    .setTitle(embedTitle)
    .setDescription(embedDescription)
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
    allowedMentions: isQueueOpened && env.PICKUP_QUEUE_ALERTS_ROLE_ID
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

  if (isQueueOpened && env.PICKUP_QUEUE_ALERTS_ROLE_ID) {
    messagePayload.content = `<@&${env.PICKUP_QUEUE_ALERTS_ROLE_ID}>`;
  }

  await sendableChannel.send(messagePayload);
}

function formatTeamLines(
  players: PickupMatchReportPayload['teams']['left'],
): string {
  if (players.length === 0) {
    return 'No players';
  }

  return players
    .map((player) => {
      const name = formatPickupPlayerName(player.personaName) || 'Player';
      const rating = typeof player.displayAfter === 'number' ? ` (${player.displayAfter})` : '';
      return `• ${name}${rating}`;
    })
    .join('\n');
}

async function postMatchReportAlert(
  client: Client,
  payload: PickupMatchReportPayload,
): Promise<void> {
  const channelId = getMatchReportsChannelId();
  if (!channelId) {
    throw new Error(
      'Neither PICKUP_MATCH_REPORTS_CHANNEL_ID nor PICKUP_QUEUE_ALERTS_CHANNEL_ID is configured.',
    );
  }

  const channel = await client.channels.fetch(channelId);

  if (!channel || !channel.isTextBased() || !('send' in channel)) {
    throw new Error('Configured pickup queue alerts channel is not a sendable text channel.');
  }

  const sendableChannel = channel as typeof channel & {
    send: (options: {
      components: ActionRowBuilder<ButtonBuilder>[];
      embeds: EmbedBuilder[];
    }) => Promise<unknown>;
  };

  const winningTeamLabel = payload.winnerTeam === 'left' ? 'Red' : 'Blue';
  const losingTeamLabel = payload.winnerTeam === 'left' ? 'Blue' : 'Red';
  const mapLabel = payload.finalMapKey?.trim() || 'Unknown';
  const scoreLabel = payload.finalScore?.trim() || 'Unknown';

  const embed = new EmbedBuilder()
    .setColor(payload.winnerTeam === 'left' ? 0xef4444 : 0x3b82f6)
    .setTitle(`${payload.queue.name} match report`)
    .setDescription(`${winningTeamLabel} won ${scoreLabel} on ${mapLabel}.`)
    .setTimestamp(new Date(payload.completedAt))
    .addFields(
      {
        name: 'Map',
        value: mapLabel,
        inline: true,
      },
      {
        name: 'Score',
        value: scoreLabel,
        inline: true,
      },
      {
        name: 'Winner',
        value: `${winningTeamLabel} Team`,
        inline: true,
      },
      {
        name: 'Red Team',
        value: formatTeamLines(payload.teams.left),
        inline: true,
      },
      {
        name: 'Blue Team',
        value: formatTeamLines(payload.teams.right),
        inline: true,
      },
      {
        name: 'Match',
        value: payload.matchId,
        inline: false,
      },
    )
    .setFooter({
      text: `${losingTeamLabel} Team lost`,
    });

  await sendableChannel.send({
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('View match')
          .setStyle(ButtonStyle.Link)
          .setURL(new URL(`/matches/${payload.matchId}`, env.PUBLIC_APP_URL).toString()),
      ),
    ],
    embeds: [embed],
  });
}

export function startPickupQueueAlertsWebhook(runtimes: readonly BotRuntime[]): HttpServer | null {
  if (
    (!env.PICKUP_QUEUE_ALERTS_CHANNEL_ID && !env.PICKUP_MATCH_REPORTS_CHANNEL_ID) ||
    !env.PICKUP_QUEUE_ALERTS_WEBHOOK_SECRET
  ) {
    logger.info('Pickup queue alerts webhook disabled');
    return null;
  }

  const secondaryRuntime = runtimes.find((runtime) => runtime.bot.id === 'secondary');

  if (!secondaryRuntime) {
    logger.warn('Pickup queue alerts are configured, but no secondary bot runtime is available');
    return null;
  }

  const server = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== pickupQueueAlertsPath) {
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

      const signatureHeader = Array.isArray(request.headers[pickupQueueAlertsSignatureHeader])
        ? request.headers[pickupQueueAlertsSignatureHeader][0]
        : request.headers[pickupQueueAlertsSignatureHeader];

      if (!hasValidSignature(rawBody, signatureHeader)) {
        response.writeHead(401).end('Invalid signature');
        return;
      }

      let parsedPayload: PickupDiscordWebhookPayload;

      try {
        parsedPayload = pickupDiscordWebhookPayloadSchema.parse(JSON.parse(rawBody));
      } catch (error) {
        logger.warn({ err: error }, 'Rejected invalid pickup queue alert payload');
        response.writeHead(400).end('Invalid payload');
        return;
      }

      const postAlert =
        parsedPayload.type === 'pickup.match_report'
          ? postMatchReportAlert(secondaryRuntime.client, parsedPayload)
          : postQueueOpenedAlert(secondaryRuntime.client, parsedPayload);

      void postAlert
        .then(() => {
          response.writeHead(204).end();
        })
        .catch((error: unknown) => {
          const channelId =
            parsedPayload.type === 'pickup.match_report'
              ? getMatchReportsChannelId()
              : getQueueAlertsChannelId();
          logger.error(
            {
              err: error,
              channelId,
              eventType: parsedPayload.type,
              queueSlug: parsedPayload.queue.slug,
            },
            'Failed to post pickup queue alert to Discord',
          );
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
        matchReportsChannelId: getMatchReportsChannelId(),
        port: env.INTERNAL_WEBHOOK_PORT,
        queueAlertsChannelId: getQueueAlertsChannelId(),
      },
      'Pickup queue alerts webhook is listening',
    );
  });

  return server;
}
