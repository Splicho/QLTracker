import { pool } from "./db.js";
import type {
  ServerHistoryPoint,
  ServerHistorySummary,
  ServerSnapshot,
} from "./types.js";

function roundDownToInterval(date: Date, intervalMs: number) {
  return new Date(Math.floor(date.getTime() / intervalMs) * intervalMs);
}

function normalizeRangeToMs(range: string) {
  if (range === "7d") {
    return 7 * 24 * 60 * 60 * 1000;
  }

  throw new Error(`Unsupported history range: ${range}`);
}

function normalizeBucketToSeconds(bucket: string) {
  if (bucket === "15m") {
    return 15 * 60;
  }

  throw new Error(`Unsupported history bucket: ${bucket}`);
}

export async function upsertServerHistorySamples(
  snapshots: ServerSnapshot[],
  sampledAt: Date
) {
  if (snapshots.length === 0) {
    return;
  }

  const values = snapshots.map((snapshot) => [
    snapshot.addr,
    sampledAt.toISOString(),
    snapshot.players,
    snapshot.maxPlayers,
    snapshot.map,
    snapshot.gameMode ?? null,
  ]);

  const placeholders = values
    .map((_, index) => {
      const offset = index * 6;
      return `($${offset + 1}, $${offset + 2}::timestamptz, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
    })
    .join(", ");
  const flatValues = values.flat();

  await pool.query(
    `
      insert into realtime.server_history_samples (
        addr,
        sampled_at,
        players,
        max_players,
        map,
        game_mode
      )
      values ${placeholders}
      on conflict (addr, sampled_at) do update
      set players = excluded.players,
          max_players = excluded.max_players,
          map = excluded.map,
          game_mode = excluded.game_mode
    `,
    flatValues
  );
}

export async function cleanupServerHistory(retentionDays: number) {
  await pool.query(
    `
      delete from realtime.server_history_samples
      where sampled_at < now() - ($1::int * interval '1 day')
    `,
    [retentionDays]
  );
}

export function getHistorySampleTime(now: Date, intervalMs: number) {
  return roundDownToInterval(now, intervalMs);
}

export async function fetchServerHistory(
  addr: string,
  range: string,
  bucket: string
): Promise<{
  summary: ServerHistorySummary | null;
  timeline: ServerHistoryPoint[];
}> {
  const rangeMs = normalizeRangeToMs(range);
  const bucketSeconds = normalizeBucketToSeconds(bucket);
  const rangeStart = new Date(Date.now() - rangeMs).toISOString();

  const timelineResult = await pool.query<{
    timestamp: Date;
    players: number;
    max_players: number;
    map: string | null;
    game_mode: string | null;
  }>(
    `
      with filtered as (
        select
          addr,
          sampled_at,
          players,
          max_players,
          map,
          game_mode,
          to_timestamp(
            floor(extract(epoch from sampled_at) / $2::numeric) * $2::numeric
          ) at time zone 'utc' as bucket_start
        from realtime.server_history_samples
        where addr = $1
          and sampled_at >= $3::timestamptz
      ),
      ranked as (
        select
          bucket_start,
          players,
          max_players,
          map,
          game_mode,
          sampled_at,
          row_number() over (
            partition by bucket_start
            order by sampled_at desc
          ) as row_number
        from filtered
      )
      select
        bucket_start as timestamp,
        players,
        max_players,
        map,
        game_mode
      from ranked
      where row_number = 1
      order by bucket_start asc
    `,
    [addr, bucketSeconds, rangeStart]
  );

  const summaryResult = await pool.query<{
    last_seen_at: Date | null;
    peak_players: number | null;
    populated_sample_ratio: string | number | null;
  }>(
    `
      select
        max(sampled_at) filter (where players > 0) as last_seen_at,
        max(players) as peak_players,
        case
          when count(*) = 0 then null
          else avg(case when players > 0 then 1 else 0 end)
        end as populated_sample_ratio
      from realtime.server_history_samples
      where addr = $1
        and sampled_at >= $2::timestamptz
    `,
    [addr, rangeStart]
  );

  const timeline = timelineResult.rows.map((row) => ({
    timestamp: row.timestamp.toISOString(),
    players: row.players,
    maxPlayers: row.max_players,
    map: row.map,
    gameMode: row.game_mode,
  }));
  const summaryRow = summaryResult.rows[0];
  const summary =
    summaryRow && (summaryRow.peak_players != null || timeline.length > 0)
      ? {
          lastSeenAt: summaryRow.last_seen_at
            ? summaryRow.last_seen_at.toISOString()
            : null,
          peakPlayers: summaryRow.peak_players ?? 0,
          populatedSampleRatio:
            typeof summaryRow.populated_sample_ratio === "string"
              ? Number(summaryRow.populated_sample_ratio)
              : summaryRow.populated_sample_ratio ?? 0,
        }
      : null;

  return {
    summary,
    timeline,
  };
}
