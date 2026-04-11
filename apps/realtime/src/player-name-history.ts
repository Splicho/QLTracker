import { pool } from "./db.js";
import type { PlayerNameHistoryEntry, ServerSnapshot } from "./types.js";

type AggregatedPlayerNameHistoryEntry = {
  steamId: string;
  playerName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenAddr: string | null;
  lastSeenServerName: string | null;
  seenCount: number;
};

function isLaterTimestamp(left: string, right: string) {
  return new Date(left).getTime() >= new Date(right).getTime();
}

function aggregatePlayerNameHistoryEntries(snapshots: ServerSnapshot[]) {
  const aggregatedEntries = new Map<string, AggregatedPlayerNameHistoryEntry>();

  for (const snapshot of snapshots) {
    const sampledAt = snapshot.updatedAt ?? new Date().toISOString();

    for (const player of snapshot.playersInfo) {
      const steamId = player.steamId?.trim();
      const playerName = player.name.trim();
      if (!steamId || !playerName) {
        continue;
      }

      const key = `${steamId}\u0000${playerName}`;
      const existingEntry = aggregatedEntries.get(key);

      if (!existingEntry) {
        aggregatedEntries.set(key, {
          steamId,
          playerName,
          firstSeenAt: sampledAt,
          lastSeenAt: sampledAt,
          lastSeenAddr: snapshot.addr,
          lastSeenServerName: snapshot.name,
          seenCount: 1,
        });
        continue;
      }

      existingEntry.seenCount += 1;
      if (sampledAt < existingEntry.firstSeenAt) {
        existingEntry.firstSeenAt = sampledAt;
      }
      if (isLaterTimestamp(sampledAt, existingEntry.lastSeenAt)) {
        existingEntry.lastSeenAt = sampledAt;
        existingEntry.lastSeenAddr = snapshot.addr;
        existingEntry.lastSeenServerName = snapshot.name;
      }
    }
  }

  return Array.from(aggregatedEntries.values());
}

function mapPlayerNameHistoryRows(
  rows: Array<{
    steam_id: string;
    player_name: string;
    first_seen_at: Date;
    last_seen_at: Date;
    last_seen_addr: string | null;
    last_seen_server_name: string | null;
    seen_count: number;
  }>
) {
  return rows.map<PlayerNameHistoryEntry>((row) => ({
    playerName: row.player_name,
    firstSeenAt: row.first_seen_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
    lastSeenAddr: row.last_seen_addr,
    lastSeenServerName: row.last_seen_server_name,
    seenCount: row.seen_count,
  }));
}

export async function upsertPlayerNameHistory(snapshots: ServerSnapshot[]) {
  const historyEntries = aggregatePlayerNameHistoryEntries(snapshots);
  if (historyEntries.length === 0) {
    return;
  }

  const placeholders = historyEntries
    .map((_, index) => {
      const offset = index * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}::timestamptz, $${offset + 4}::timestamptz, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    })
    .join(", ");
  const values = historyEntries.flatMap((entry) => [
    entry.steamId,
    entry.playerName,
    entry.firstSeenAt,
    entry.lastSeenAt,
    entry.lastSeenAddr,
    entry.lastSeenServerName,
    entry.seenCount,
  ]);

  await pool.query(
    `
      insert into realtime.player_name_history (
        steam_id,
        player_name,
        first_seen_at,
        last_seen_at,
        last_seen_addr,
        last_seen_server_name,
        seen_count
      )
      values ${placeholders}
      on conflict (steam_id, player_name) do update
      set first_seen_at = least(
            realtime.player_name_history.first_seen_at,
            excluded.first_seen_at
          ),
          last_seen_at = greatest(
            realtime.player_name_history.last_seen_at,
            excluded.last_seen_at
          ),
          last_seen_addr = case
            when excluded.last_seen_at >= realtime.player_name_history.last_seen_at
              then excluded.last_seen_addr
            else realtime.player_name_history.last_seen_addr
          end,
          last_seen_server_name = case
            when excluded.last_seen_at >= realtime.player_name_history.last_seen_at
              then excluded.last_seen_server_name
            else realtime.player_name_history.last_seen_server_name
          end,
          seen_count = realtime.player_name_history.seen_count + excluded.seen_count
    `,
    values
  );
}

export async function fetchPlayerNameHistory(steamId: string) {
  const result = await pool.query<{
    steam_id: string;
    player_name: string;
    first_seen_at: Date;
    last_seen_at: Date;
    last_seen_addr: string | null;
    last_seen_server_name: string | null;
    seen_count: number;
  }>(
    `
      select
        steam_id,
        player_name,
        first_seen_at,
        last_seen_at,
        last_seen_addr,
        last_seen_server_name,
        seen_count
      from realtime.player_name_history
      where steam_id = $1
      order by last_seen_at desc, player_name asc
    `,
    [steamId]
  );

  return mapPlayerNameHistoryRows(result.rows);
}

export async function fetchPlayerNameHistoryLookup(steamIds: string[]) {
  if (steamIds.length === 0) {
    return {};
  }

  const result = await pool.query<{
    steam_id: string;
    player_name: string;
    first_seen_at: Date;
    last_seen_at: Date;
    last_seen_addr: string | null;
    last_seen_server_name: string | null;
    seen_count: number;
  }>(
    `
      select
        steam_id,
        player_name,
        first_seen_at,
        last_seen_at,
        last_seen_addr,
        last_seen_server_name,
        seen_count
      from realtime.player_name_history
      where steam_id = any($1::text[])
      order by steam_id asc, last_seen_at desc, player_name asc
    `,
    [steamIds]
  );

  const histories = Object.fromEntries(
    steamIds.map((steamId) => [steamId, [] as PlayerNameHistoryEntry[]])
  );

  for (const row of result.rows) {
    histories[row.steam_id] ??= [];
    histories[row.steam_id].push({
      playerName: row.player_name,
      firstSeenAt: row.first_seen_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      lastSeenAddr: row.last_seen_addr,
      lastSeenServerName: row.last_seen_server_name,
      seenCount: row.seen_count,
    });
  }

  return histories;
}
