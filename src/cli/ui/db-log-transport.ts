import type { Pool } from 'pg';
import { sessionLocalStorage } from '../../server/session-storage.js';
import { eventBus } from '../../server/event-bus.js';

let _pool: Pool | null = null;

export function injectLogPool(pool: Pool): void {
  _pool = pool;
}

export function dbLogEntry(level: string, message: string, meta?: any): void {
  const sessionId = sessionLocalStorage.getStore();

  if (sessionId) {
    eventBus.emitLog(sessionId, {
      level,
      message,
      timestamp: Date.now(),
    });
  }

  if (!_pool) return;
  const { level: _l, message: _m, timestamp: _ts, ...rest } = meta ?? {};
  const cleanMeta = Object.keys(rest).length > 0 ? rest : null;
  _pool
    .query(
      `INSERT INTO app_logs (level, message, meta, session_id, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [
        String(level),
        String(message),
        cleanMeta ? JSON.stringify(cleanMeta) : null,
        sessionId || null,
        Date.now(),
      ],
    )
    .catch(() => {});
}
