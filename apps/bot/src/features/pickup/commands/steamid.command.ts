import { SlashCommandBuilder } from 'discord.js';

import { queryRows } from '../../../shared/database.js';
import { formatPickupPlayerName } from '../../../shared/pickup-player-name.js';

import type { SlashCommand } from '../../../discord/types.js';

type PlayerRow = {
  id: string;
  personaName: string;
  profileUrl: string | null;
  steamId: string;
};

function normalizeSteamId(value: string): string | null {
  const steamId = value.trim();
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

async function findPickupPlayer(steamId: string) {
  const rows = await queryRows<PlayerRow>(
    `
      select "id", "personaName", "profileUrl", "steamId"
      from "PickupPlayer"
      where "steamId" = $1
      limit 1
    `,
    [steamId]
  );

  return rows[0] ?? null;
}

async function upsertDiscordLink(discordUserId: string, playerId: string) {
  await queryRows(
    `
      insert into "PickupDiscordLink" ("id", "discordUserId", "playerId", "createdAt", "updatedAt")
      values (gen_random_uuid()::text, $1, $2, now(), now())
      on conflict ("discordUserId")
      do update set "playerId" = excluded."playerId", "updatedAt" = now()
    `,
    [discordUserId, playerId]
  );
}

function steamProfileUrl(player: PlayerRow) {
  return player.profileUrl?.trim() || `https://steamcommunity.com/profiles/${player.steamId}`;
}

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

    let player: PlayerRow | null = null;
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

    const playerName = formatPickupPlayerName(player.personaName) || 'Player';

    await interaction.editReply(
      `${interaction.user} you successfully linked your Discord account to [${playerName}](${steamProfileUrl(player)}).`
    );
  }
};
