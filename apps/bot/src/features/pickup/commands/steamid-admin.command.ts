import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember
} from 'discord.js';

import type { SlashCommand } from '../../../discord/types.js';
import {
  deleteDiscordLink,
  findLinkedPickupPlayer,
  findPickupPlayer,
  formatLinkedPlayerName,
  normalizeSteamId,
  steamProfileUrl,
  upsertDiscordLink
} from '../../../shared/pickup-discord-links.js';

function isAdministrator(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild() || !interaction.member) {
    return false;
  }

  return (interaction.member as GuildMember).permissions.has(
    PermissionFlagsBits.Administrator
  );
}

export const steamIdAdminCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('steamid-admin')
    .setDescription('Admin tools for pickup Discord links.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Link a Discord user to a pickup SteamID64.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord user to link')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('steam_id')
            .setDescription('SteamID64 to link')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a Discord user pickup link.')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('Discord user to unlink')
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    await interaction.deferReply();

    if (!isAdministrator(interaction)) {
      await interaction.editReply('This command requires Discord Administrator permission.');
      return;
    }

    const subcommand = interaction.options.getSubcommand(true);
    const targetUser = interaction.options.getUser('user', true);

    if (subcommand === 'remove') {
      try {
        const linkedPlayer = await findLinkedPickupPlayer(targetUser.id);
        if (!linkedPlayer) {
          await interaction.editReply(`${targetUser} has no pickup link to remove.`);
          return;
        }

        await deleteDiscordLink(targetUser.id);
        await interaction.editReply(
          `Removed pickup link for ${targetUser} from [${formatLinkedPlayerName(linkedPlayer)}](${steamProfileUrl(linkedPlayer)}).`
        );
      } catch {
        await interaction.editReply('Pickup account admin linking is unavailable right now.');
      }

      return;
    }

    const steamId = normalizeSteamId(
      interaction.options.getString('steam_id', true)
    );

    if (!steamId) {
      await interaction.editReply('That steam_id is not a valid SteamID64.');
      return;
    }

    try {
      const player = await findPickupPlayer(steamId);
      if (!player) {
        await interaction.editReply(
          `No QLTracker pickup player was found for SteamID ${steamId}.`
        );
        return;
      }

      await upsertDiscordLink(targetUser.id, player.id);
      await interaction.editReply(
        `Linked ${targetUser} to [${formatLinkedPlayerName(player)}](${steamProfileUrl(player)}).`
      );
    } catch {
      await interaction.editReply('Pickup account admin linking is unavailable right now.');
    }
  }
};
