import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      connectionTimeoutMillis: 3000,
      max: 5,
    });
  }

  return pool;
}

export async function query<T = unknown>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const p = getPool();
  if (!p) return [];
  try {
    const result = await p.query(sql, values);
    return result.rows as T[];
  } catch {
    return [];
  }
}
