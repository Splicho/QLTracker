import { REST, Routes } from 'discord.js';

import { env } from '../config/env.js';
import { slashCommands } from '../discord/command-registry.js';
import { logger } from '../shared/logger.js';

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const commandPayload = slashCommands.map((command) => command.data.toJSON());

  if (env.DISCORD_GUILD_ID) {
    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID),
      {
        body: commandPayload
      }
    );

    logger.info(
      { scope: 'guild', guildId: env.DISCORD_GUILD_ID, commandCount: commandPayload.length },
      'Registered slash commands'
    );

    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
    body: commandPayload
  });

  logger.info({ scope: 'global', commandCount: commandPayload.length }, 'Registered slash commands');
}

void registerCommands().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to register slash commands');
  process.exitCode = 1;
});
