import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { env } from '../../../config/env.js';
import type { SlashCommand } from '../../../discord/types.js';
import { queryRows } from '../../../shared/database.js';
import { formatPickupPlayerName } from '../../../shared/pickup-player-name.js';
import { formatQueueName, listActiveQueueChoices } from '../../../shared/pickup-queues.js';

type LeaderboardRow = {
  displayRating: number;
  gamesPlayed: number;
  losses: number;
  personaName: string;
  queueName: string;
  steamId: string;
  wins: number;
};

function buildProfileUrl(steamId: string) {
  const baseUrl = (env.PUBLIC_APP_URL?.trim() || 'https://qltracker.com').replace(/\/$/, '');
  return `${baseUrl}/players/${steamId}`;
}

async function fetchLeaderboard(queueSlug: string, limit: number) {
  const rows = await queryRows<LeaderboardRow>(
    `
      select
        q."name" as "queueName",
        p."steamId",
        p."personaName",
        r."displayRating",
        r."gamesPlayed",
        r."wins",
        r."losses"
      from "PickupQueue" q
      join "PickupSeason" s
        on s."queueId" = q."id"
       and s."status" = 'active'
      join "PickupPlayerSeasonRating" r
        on r."seasonId" = s."id"
      join "PickupPlayer" p
        on p."id" = r."playerId"
      where q."slug" = $1
      order by r."displayRating" desc, r."gamesPlayed" desc, p."personaName" asc
      limit $2
    `,
    [queueSlug, limit]
  );

  return rows;
}

function buildDescription(rows: LeaderboardRow[]) {
  return rows
    .map((row, index) => {
      const name = formatPickupPlayerName(row.personaName) || 'Player';
      const profileUrl = buildProfileUrl(row.steamId);
      return `**${index + 1}.** [${name}](${profileUrl})  **${row.displayRating}**  ${row.wins}W-${row.losses}L  ${row.gamesPlayed} GP`;
    })
    .join('\n');
}

export const ratingsCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ratings')
    .setDescription('Show the top pickup ratings for a selected queue.')
    .addStringOption((option) =>
      option
        .setName('queue')
        .setDescription('Pickup queue')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('Number of ratings to show')
        .setRequired(false)
        .addChoices(
          { name: '10', value: 10 },
          { name: '20', value: 20 },
          { name: '25', value: 25 },
          { name: '50', value: 50 }
        )
    ),
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused();

    try {
      await interaction.respond(await listActiveQueueChoices(String(focused)));
    } catch {
      await interaction.respond([]);
    }
  },
  async execute(interaction) {
    const queueSlug = interaction.options.getString('queue', true).trim();
    const limit = interaction.options.getInteger('limit') ?? 10;

    await interaction.deferReply();

    let rows: LeaderboardRow[] = [];
    try {
      rows = await fetchLeaderboard(queueSlug, limit);
    } catch {
      await interaction.editReply('Pickup ratings are unavailable right now.');
      return;
    }

    if (rows.length === 0) {
      await interaction.editReply(`No active ratings found for "${queueSlug}".`);
      return;
    }

    const queueName = formatQueueName(rows[0]!.queueName);
    const embed = new EmbedBuilder()
      .setColor(0xffc857)
      .setTitle(`Top ${rows.length} ${queueName} ratings`)
      .setDescription(buildDescription(rows))
      .setFooter({
        text: 'Each player name links to their QLTracker profile.'
      });

    await interaction.editReply({
      embeds: [embed]
    });
  }
};
