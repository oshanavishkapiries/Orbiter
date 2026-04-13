import Database from 'better-sqlite3';
import { getDb } from '../connection.js';
import { generateId } from '../../../utils/id.js';

export abstract class BaseRepository<T> {
  protected db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * Generate unique ID
   */
  protected generateId(prefix: string): string {
    return generateId(prefix);
  }

  /**
   * Get current timestamp
   */
  protected now(): number {
    return Date.now();
  }

  /**
   * Parse JSON safely
   */
  protected parseJson<R>(json: string | null): R | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as R;
    } catch {
      return null;
    }
  }

  /**
   * Stringify for JSON column
   */
  protected toJson(data: any): string {
    return JSON.stringify(data);
  }
}
