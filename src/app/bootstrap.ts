import { Client, GatewayIntentBits } from 'discord.js';

import { env } from '../config/env.js';
import { discordEvents } from '../events/index.js';
import { registerEvents } from '../discord/register-events.js';
import { logger } from '../shared/logger.js';

function createClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds]
  });
}

function registerShutdownHandlers(client: Client): void {
  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'Shutting down Discord bot');
    client.destroy();
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

export async function startBot(): Promise<void> {
  const client = createClient();

  registerEvents(client, discordEvents);
  registerShutdownHandlers(client);

  await client.login(env.DISCORD_TOKEN);

  logger.info('Discord login successful');
}
