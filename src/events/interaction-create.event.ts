import { Events, MessageFlags } from 'discord.js';

import type { BotDefinition } from '../bots/types.js';
import { logger } from '../shared/logger.js';

import type { DiscordEvent } from '../discord/types.js';

export function createInteractionCreateEvent(
  bot: BotDefinition
): DiscordEvent<Events.InteractionCreate> {
  const commandMap = new Map(bot.commands.map((command) => [command.data.name, command] as const));

  return {
    name: Events.InteractionCreate,
    async execute(interaction) {
      if (!interaction.isChatInputCommand()) {
        return;
      }

      const command = commandMap.get(interaction.commandName);

      if (!command) {
        logger.warn(
          {
            botId: bot.id,
            botName: bot.displayName,
            commandName: interaction.commandName,
            userId: interaction.user.id
          },
          'Received unknown slash command'
        );

        await interaction.reply({
          content: 'That command is not available on this bot instance.',
          flags: MessageFlags.Ephemeral
        });

        return;
      }

      try {
        await command.execute(interaction);
      } catch (error: unknown) {
        logger.error(
          {
            err: error,
            botId: bot.id,
            botName: bot.displayName,
            commandName: interaction.commandName,
            userId: interaction.user.id
          },
          'Slash command execution failed'
        );

        const response = {
          content: 'Something went wrong while executing that command.',
          flags: MessageFlags.Ephemeral
        } as const;

        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(response);
          return;
        }

        await interaction.reply(response);
      }
    }
  };
}
