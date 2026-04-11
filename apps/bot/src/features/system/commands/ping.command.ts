import { SlashCommandBuilder } from 'discord.js';

import type { SlashCommand } from '../../../discord/types.js';

export const pingCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check whether the bot is reachable.'),
  async execute(interaction) {
    await interaction.reply({
      content: `Pong! Gateway latency is ${Math.round(interaction.client.ws.ping)}ms.`
    });
  }
};
