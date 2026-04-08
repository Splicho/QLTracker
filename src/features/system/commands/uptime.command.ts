import { SlashCommandBuilder } from 'discord.js';

import { formatDuration } from '../../../shared/format-duration.js';

import type { SlashCommand } from '../../../discord/types.js';

export const uptimeCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Show how long the bot process has been online.'),
  async execute(interaction) {
    const uptimeMs = interaction.client.uptime ?? 0;

    await interaction.reply({
      content: `Online for ${formatDuration(uptimeMs)}.`
    });
  }
};
