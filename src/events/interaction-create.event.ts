import { Events, MessageFlags } from 'discord.js';

import { getSlashCommand } from '../discord/command-registry.js';
import { logger } from '../shared/logger.js';

import type { DiscordEvent } from '../discord/types.js';

export const interactionCreateEvent: DiscordEvent<Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = getSlashCommand(interaction.commandName);

    if (!command) {
      logger.warn(
        { commandName: interaction.commandName, userId: interaction.user.id },
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
        { err: error, commandName: interaction.commandName, userId: interaction.user.id },
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
