import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from '../../cli/ui/logger.js';
import { ensureDir } from '../../utils/fs.js';
import { CREATE_TABLES_SQL, MIGRATIONS, SCHEMA_VERSION } from './schema.js';

const DB_DIR = path.join(process.cwd(), '.orbiter');
const DB_PATH = path.join(DB_DIR, 'memory.db');

export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private db: Database.Database;

  private constructor() {
    ensureDir(DB_DIR);

    this.db = new Database(DB_PATH, {
      // Enable WAL mode for better concurrency
      // verbose: console.log, // Uncomment for debugging
    });

    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');

    // Initialize schema
    this.initializeSchema();

    logger.debug(`Database connected: ${DB_PATH}`);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Get database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    try {
      // Create tables
      this.db.exec(CREATE_TABLES_SQL);

      // Check and apply migrations
      this.applyMigrations();

      logger.debug('Database schema initialized');
    } catch (error) {
      logger.error(
        `Failed to initialize database: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Apply pending migrations
   */
  private applyMigrations(): void {
    const currentVersion = this.getCurrentSchemaVersion();

    for (
      let version = currentVersion + 1;
      version <= SCHEMA_VERSION;
      version++
    ) {
      const migration = MIGRATIONS[version];
      if (migration) {
        logger.debug(`Applying migration to version ${version}`);
        this.db.exec(migration);
        this.db
          .prepare(
            'INSERT INTO schema_version (version, applied_at) VALUES (?, ?)',
          )
          .run(version, Date.now());
      }
    }
  }

  /**
   * Get current schema version
   */
  private getCurrentSchemaVersion(): number {
    try {
      const result = this.db
        .prepare('SELECT MAX(version) as version FROM schema_version')
        .get() as { version: number } | undefined;
      return result?.version || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    DatabaseConnection.instance = null;
    logger.debug('Database connection closed');
  }

  /**
   * Run in transaction
   */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /**
   * Backup database
   */
  async backup(backupPath?: string): Promise<string> {
    const targetPath =
      backupPath || path.join(DB_DIR, `memory-backup-${Date.now()}.db`);

    await this.db.backup(targetPath);
    logger.success(`Database backed up to: ${targetPath}`);

    return targetPath;
  }

  /**
   * Get database stats
   */
  getStats(): {
    path: string;
    size: string;
    tables: Record<string, number>;
  } {
    const stats = fs.statSync(DB_PATH);
    const size = this.formatBytes(stats.size);

    const tables: Record<string, number> = {};
    const tableNames = [
      'memories',
      'selectors',
      'selector_fallbacks',
      'error_patterns',
      'site_behaviors',
      'page_structures',
      'successful_flows',
      'usage_logs',
    ];

    for (const table of tableNames) {
      const result = this.db
        .prepare(`SELECT COUNT(*) as count FROM ${table}`)
        .get() as { count: number };
      tables[table] = result.count;
    }

    return { path: DB_PATH, size, tables };
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
}

/**
 * Get database instance (convenience function)
 */
export function getDb(): Database.Database {
  return DatabaseConnection.getInstance().getDb();
}
