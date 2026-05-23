import type { Pool } from 'pg';

let _pool: Pool | null = null;

export function injectLogPool(pool: Pool): void {
  _pool = pool;
}

export function dbLogEntry(level: string, message: string, meta?: any): void {
  if (!_pool) return;
  const { level: _l, message: _m, timestamp: _ts, ...rest } = meta ?? {};
  const cleanMeta = Object.keys(rest).length > 0 ? rest : null;
  _pool
    .query(
      `INSERT INTO app_logs (level, message, meta, created_at) VALUES ($1, $2, $3, $4)`,
      [String(level), String(message), cleanMeta ? JSON.stringify(cleanMeta) : null, Date.now()],
    )
    .catch(() => {});
}
