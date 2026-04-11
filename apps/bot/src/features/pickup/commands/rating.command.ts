import { SlashCommandBuilder } from 'discord.js';

import { queryRows } from '../../../shared/database.js';
import { formatQueueName, listActiveQueueChoices } from '../../../shared/pickup-queues.js';

import type { SlashCommand } from '../../../discord/types.js';

type RatingRow = {
  displayRating: number | null;
  gamesPlayed: number | null;
  losses: number | null;
  personaName: string | null;
  queueName: string;
  steamId: string | null;
  wins: number | null;
};

type LinkedSteamIdRow = {
  steamId: string;
};

function normalizeSteamId(value: string | null): string | null {
  const steamId = value?.trim() ?? '';
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

async function fetchRating(queueSlug: string, steamId: string) {
  const rows = await queryRows<RatingRow>(
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
      left join "PickupPlayer" p
        on p."steamId" = $2
      left join "PickupPlayerSeasonRating" r
        on r."seasonId" = s."id"
       and r."playerId" = p."id"
      where q."slug" = $1
      order by s."startsAt" desc
      limit 1
    `,
    [queueSlug, steamId]
  );

  return rows[0] ?? null;
}

async function fetchLinkedSteamId(discordUserId: string) {
  const rows = await queryRows<LinkedSteamIdRow>(
    `
      select p."steamId"
      from "PickupDiscordLink" l
      join "PickupPlayer" p
        on p."id" = l."playerId"
      where l."discordUserId" = $1
      limit 1
    `,
    [discordUserId]
  );

  return rows[0]?.steamId ?? null;
}

export const ratingCommand: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('rating')
    .setDescription('Show a pickup rating for a selected queue.')
    .addStringOption((option) =>
      option
        .setName('queue')
        .setDescription('Pickup queue')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('steam_id')
        .setDescription('Optional SteamID64 override')
        .setRequired(false)
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
    const rawSteamId = interaction.options.getString('steam_id');
    const steamIdOverride = normalizeSteamId(rawSteamId);

    await interaction.deferReply();

    if (rawSteamId && !steamIdOverride) {
      await interaction.editReply('That steam_id is not a valid SteamID64.');
      return;
    }

    let steamId = steamIdOverride;
    if (!steamId) {
      try {
        steamId = await fetchLinkedSteamId(interaction.user.id);
      } catch {
        await interaction.editReply('Pickup ratings are unavailable right now.');
        return;
      }

      if (!steamId) {
        await interaction.editReply(
          `${interaction.user} has no linked Steam account for pickup ratings yet. Use /steamid first.`
        );
        return;
      }
    }

    let rating: RatingRow | null = null;
    try {
      rating = await fetchRating(queueSlug, steamId);
    } catch {
      await interaction.editReply('Pickup ratings are unavailable right now.');
      return;
    }

    if (!rating) {
      await interaction.editReply(`No active pickup queue found for "${queueSlug}".`);
      return;
    }

    const queueName = formatQueueName(rating.queueName);

    if (!rating.personaName) {
      await interaction.editReply(`No pickup player found for SteamID ${steamId}.`);
      return;
    }

    if (rating.displayRating === null) {
      await interaction.editReply(`Your current **${queueName}** rating is unavailable.`);
      return;
    }

    await interaction.editReply(
      `Your current **${queueName}** rating is **${rating.displayRating}** (${rating.wins ?? 0}W-${rating.losses ?? 0}L, ${rating.gamesPlayed ?? 0} games).`
    );
  }
};
