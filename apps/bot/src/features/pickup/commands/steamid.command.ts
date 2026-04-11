import { SlashCommandBuilder } from 'discord.js';

import {
  findPickupPlayer,
  formatLinkedPlayerName,
  normalizeSteamId,
  steamProfileUrl,
  upsertDiscordLink
} from '../../../shared/pickup-discord-links.js';

import type { SlashCommand } from '../../../discord/types.js';

export const steamIdCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('steamid')
    .setDescription('Link your Discord account to your QLTracker pickup SteamID64.')
    .addStringOption((option) =>
      option
        .setName('steam_id')
        .setDescription('Your SteamID64')
        .setRequired(true)
    ),
  async execute(interaction) {
    const steamId = normalizeSteamId(interaction.options.getString('steam_id', true));

    await interaction.deferReply();

    if (!steamId) {
      await interaction.editReply('That steam_id is not a valid SteamID64.');
      return;
    }

    let player = null;
    try {
      player = await findPickupPlayer(steamId);
    } catch {
      await interaction.editReply('Pickup account linking is unavailable right now.');
      return;
    }

    if (!player) {
      await interaction.editReply(
        `No QLTracker pickup player was found for SteamID ${steamId}. Join pickup with that Steam account first, then run /steamid again.`
      );
      return;
    }

    try {
      await upsertDiscordLink(interaction.user.id, player.id);
    } catch {
      await interaction.editReply('Pickup account linking is unavailable right now.');
      return;
    }

    const playerName = formatLinkedPlayerName(player);

    await interaction.editReply(
      `${interaction.user} successfully linked your Discord account to [${playerName}](${steamProfileUrl(player)}).`
    );
  }
};
