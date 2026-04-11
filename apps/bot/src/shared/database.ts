import { Pool } from 'pg';

import { env } from '../config/env.js';

let pool: Pool | null = null;

export function getDatabasePool(): Pool | null {
  if (!env.DATABASE_URL) {
    return null;
  }

  pool ??= new Pool({
    connectionString: env.DATABASE_URL
  });

  return pool;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(env.DATABASE_URL);
}

export async function queryRows<T extends Record<string, unknown>>(
  sql: string,
  values: readonly unknown[] = []
): Promise<T[]> {
  const database = getDatabasePool();

  if (!database) {
    throw new Error('DATABASE_URL is not configured for the bot.');
  }

  const result = await database.query<T>(sql, [...values]);
  return result.rows;
}
