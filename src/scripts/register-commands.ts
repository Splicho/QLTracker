import { REST, Routes } from 'discord.js';

import { botDefinitions } from '../bots/definitions.js';
import { logger } from '../shared/logger.js';

import type { BotDefinition } from '../bots/types.js';

async function registerCommandsForBot(bot: BotDefinition): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(bot.token);
  const commandPayload = bot.commands.map((command) => command.data.toJSON());

  if (bot.guildId) {
    await rest.put(Routes.applicationGuildCommands(bot.clientId, bot.guildId), {
      body: commandPayload
    });

    logger.info(
      {
        botId: bot.id,
        botName: bot.displayName,
        scope: 'guild',
        guildId: bot.guildId,
        commandCount: commandPayload.length
      },
      'Registered slash commands'
    );

    return;
  }

  await rest.put(Routes.applicationCommands(bot.clientId), {
    body: commandPayload
  });

  logger.info(
    {
      botId: bot.id,
      botName: bot.displayName,
      scope: 'global',
      commandCount: commandPayload.length
    },
    'Registered slash commands'
  );
}

async function registerCommands(): Promise<void> {
  await Promise.all(botDefinitions.map((bot) => registerCommandsForBot(bot)));

  logger.info({ botCount: botDefinitions.length }, 'Registered slash commands for configured bots');
}

void registerCommands().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to register slash commands for configured bots');
  process.exitCode = 1;
});
