import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

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
  losses: string;
  name: string;
  rank: string;
  rating: string;
  wins: string;
};

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

function buildDisplayRows(rows: LeaderboardRow[]): LeaderboardDisplayRow[] {
  return rows.map((row, index) => {
    const name = truncateCell(formatPickupPlayerName(row.personaName) || 'Player', 16);
    return {
      rank: String(index + 1),
      name,
      rating: String(row.displayRating),
      wins: String(row.wins),
      losses: String(row.losses),
      gamesPlayed: String(row.gamesPlayed)
    };
  });
}

function buildTable(rows: LeaderboardDisplayRow[]) {
  const columns = [
    { key: 'rank', label: '#', minWidth: 2, align: 'right' },
    { key: 'name', label: 'Player', minWidth: 12, align: 'left' },
    { key: 'rating', label: 'Rating', minWidth: 6, align: 'right' },
    { key: 'wins', label: 'W', minWidth: 1, align: 'right' },
    { key: 'losses', label: 'L', minWidth: 1, align: 'right' },
    { key: 'gamesPlayed', label: 'Games', minWidth: 5, align: 'right' }
  ] as const;

  const widths = columns.map((column) => {
    const values = rows.map((row) => (row as Record<string, string>)[column.key] ?? '');
    return Math.max(column.minWidth, column.label.length, ...values.map((value) => value.length));
  });

  function formatCell(value: string, width: number, align: 'left' | 'right') {
    return align === 'right' ? value.padStart(width, ' ') : value.padEnd(width, ' ');
  }

  const normalizedBorder = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const header = `|${columns
    .map((column, index) => ` ${formatCell(column.label, widths[index]!, column.align)} `)
    .join('|')}|`;
  const body = rows.map((row) => {
    const record = row as Record<string, string>;
    return `|${columns
      .map((column, index) =>
        ` ${formatCell(record[column.key] ?? '', widths[index]!, column.align)} `
      )
      .join('|')}|`;
  });

  return ['```text', normalizedBorder, header, normalizedBorder, ...body, normalizedBorder, '```'].join('\n');
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
      .setDescription(buildTable(displayRows));

    await interaction.editReply({
      embeds: [embed]
    });
  }
};
