import { formatPickupPlayerName } from './pickup-player-name.js';
import { queryRows } from './database.js';

type PlayerRow = {
  id: string;
  personaName: string;
  profileUrl: string | null;
  steamId: string;
};

type LinkedPlayerRow = PlayerRow & {
  discordUserId: string;
};

export function normalizeSteamId(value: string): string | null {
  const steamId = value.trim();
  return /^\d{17}$/.test(steamId) ? steamId : null;
}

export function steamProfileUrl(player: Pick<PlayerRow, 'profileUrl' | 'steamId'>) {
  return player.profileUrl?.trim() || `https://steamcommunity.com/profiles/${player.steamId}`;
}

export function formatLinkedPlayerName(player: Pick<PlayerRow, 'personaName'>) {
  return formatPickupPlayerName(player.personaName) || 'Player';
}

export async function findPickupPlayer(steamId: string) {
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

export async function findLinkedPickupPlayer(discordUserId: string) {
  const rows = await queryRows<LinkedPlayerRow>(
    `
      select p."id", p."personaName", p."profileUrl", p."steamId", l."discordUserId"
      from "PickupDiscordLink" l
      join "PickupPlayer" p
        on p."id" = l."playerId"
      where l."discordUserId" = $1
      limit 1
    `,
    [discordUserId]
  );

  return rows[0] ?? null;
}

export async function upsertDiscordLink(discordUserId: string, playerId: string) {
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

export async function deleteDiscordLink(discordUserId: string) {
  const rows = await queryRows<{ playerId: string }>(
    `
      delete from "PickupDiscordLink"
      where "discordUserId" = $1
      returning "playerId"
    `,
    [discordUserId]
  );

  return rows[0] ?? null;
}
