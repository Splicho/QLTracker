import { REST, Routes } from 'discord.js';

import { logger } from '../shared/logger.js';

import type { BotDefinition } from '../bots/types.js';

export async function registerCommandsForBot(bot: BotDefinition): Promise<void> {
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
        commandCount: commandPayload.length,
        commands: bot.commands.map((command) => `/${command.data.name}`)
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
      commandCount: commandPayload.length,
      commands: bot.commands.map((command) => `/${command.data.name}`)
    },
    'Registered slash commands'
  );
}

export async function registerCommandsForBots(bots: readonly BotDefinition[]): Promise<void> {
  await Promise.all(bots.map((bot) => registerCommandsForBot(bot)));

  logger.info({ botCount: bots.length }, 'Registered slash commands for configured bots');
}
