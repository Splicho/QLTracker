import type { Server as HttpServer } from 'node:http';
import { Client, GatewayIntentBits } from 'discord.js';

import { botDefinitions } from '../bots/definitions.js';
import { registerEvents } from '../discord/register-events.js';
import { createDiscordEvents } from '../events/index.js';
import { startPickupQueueAlertsWebhook } from '../features/pickup-queue-alerts/webhook-server.js';
import { logger } from '../shared/logger.js';

import type { BotDefinition } from '../bots/types.js';

interface BotRuntime {
  readonly bot: BotDefinition;
  readonly client: Client;
}

function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds]
  });
}

function registerShutdownHandlers(
  runtimes: readonly BotRuntime[],
  cleanupCallbacks: readonly (() => void)[],
): void {
  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals): void => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;

    logger.info({ signal, botCount: runtimes.length }, 'Shutting down Discord bots');

    for (const cleanup of cleanupCallbacks) {
      cleanup();
    }

    for (const runtime of runtimes) {
      runtime.client.destroy();
    }

    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

async function startRuntime(runtime: BotRuntime): Promise<void> {
  registerEvents(runtime.client, createDiscordEvents(runtime.bot), runtime.bot);
  await runtime.client.login(runtime.bot.token);

  logger.info(
    { botId: runtime.bot.id, botName: runtime.bot.displayName },
    'Discord login successful'
  );
}

export async function startBots(): Promise<void> {
  const runtimes = botDefinitions.map((bot) => ({
    bot,
    client: createClient()
  }));
  let queueAlertsServer: HttpServer | null = null;

  try {
    await Promise.all(runtimes.map((runtime) => startRuntime(runtime)));
    queueAlertsServer = startPickupQueueAlertsWebhook(runtimes);
  } catch (error: unknown) {
    queueAlertsServer?.close();

    for (const runtime of runtimes) {
      runtime.client.destroy();
    }

    throw error;
  }

  registerShutdownHandlers(runtimes, [
    () => {
      queueAlertsServer?.close();
    }
  ]);

  logger.info({ botCount: runtimes.length }, 'Configured Discord bots started');
}
