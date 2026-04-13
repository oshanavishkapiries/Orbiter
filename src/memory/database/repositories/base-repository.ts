import { Pool } from 'pg';
import { getPool } from '../connection.js';
import { generateId } from '../../../utils/id.js';

export abstract class BaseRepository<T> {
  protected pool: Pool;

  constructor() {
    this.pool = getPool();
  }

  protected generateId(prefix: string): string {
    return generateId(prefix);
  }

  protected now(): number {
    return Date.now();
  }

  protected parseJson<R>(json: string | null): R | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as R;
    } catch {
      return null;
    }
  }

  protected toJson(data: any): string {
    return JSON.stringify(data);
  }
}
