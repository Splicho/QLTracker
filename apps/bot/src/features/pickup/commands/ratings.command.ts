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

type LeaderboardDisplayRow = {
  gamesPlayed: string;
  linkLine: string;
  losses: string;
  name: string;
  rank: string;
  rating: string;
  wins: string;
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

function truncateCell(value: string, maxWidth: number) {
  if (value.length <= maxWidth) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxWidth - 1))}\u2026`;
}

function padCell(value: string, width: number) {
  return value.padEnd(width, ' ');
}

function buildDisplayRows(rows: LeaderboardRow[]): LeaderboardDisplayRow[] {
  return rows.map((row, index) => {
    const name = truncateCell(formatPickupPlayerName(row.personaName) || 'Player', 16);
    return {
      rank: String(index + 1),
      name,
      rating: String(row.displayRating),
      wins: String(row.wins),
      losses: String(row.losses),
      gamesPlayed: String(row.gamesPlayed),
      linkLine: `**${index + 1}.** [${formatPickupPlayerName(row.personaName) || 'Player'}](${buildProfileUrl(row.steamId)})`
    };
  });
}

function buildTable(rows: LeaderboardDisplayRow[]) {
  const columns = [
    { key: 'rank', label: '#', width: 3 },
    { key: 'name', label: 'Player', width: 16 },
    { key: 'rating', label: 'Rating', width: 6 },
    { key: 'wins', label: 'W', width: 3 },
    { key: 'losses', label: 'L', width: 3 },
    { key: 'gamesPlayed', label: 'GP', width: 4 }
  ] as const;

  const border = `+${columns.map((column) => '-'.repeat(column.width + 2)).join('+')}+`;
  const header = `|${columns
    .map((column) => ` ${padCell(column.label, column.width)} `)
    .join('|')}|`;
  const body = rows.map((row) => {
    const record = row as Record<string, string>;
    return `|${columns
      .map((column) => ` ${padCell(record[column.key] ?? '', column.width)} `)
      .join('|')}|`;
  });

  return ['```text', border, header, border, ...body, border, '```'].join('\n');
}

function chunkLines(lines: string[], maxLength: number) {
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength) {
      if (current) {
        chunks.push(current);
      }
      current = line;
      continue;
    }
    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
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
    const displayRows = buildDisplayRows(rows);
    const embed = new EmbedBuilder()
      .setColor(0xffc857)
      .setTitle(`Top ${rows.length} ${queueName} Ratings`)
      .setDescription(buildTable(displayRows))
      .setFooter({
        text: 'Profiles are listed below the table.'
      });

    const profileChunks = chunkLines(
      displayRows.map((row) => row.linkLine),
      1000
    ).slice(0, 5);

    for (const [index, chunk] of profileChunks.entries()) {
      embed.addFields({
        name: index === 0 ? 'Profiles' : `Profiles ${index + 1}`,
        value: chunk
      });
    }

    await interaction.editReply({
      embeds: [embed]
    });
  }
};
