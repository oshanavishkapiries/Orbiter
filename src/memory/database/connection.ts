import { Pool, PoolClient } from 'pg';
import { logger } from '../../cli/ui/logger.js';
import { CREATE_TABLES_SQL, MIGRATIONS, SCHEMA_VERSION } from './schema.js';

function getConnectionString(): string {
  return (
    process.env.DATABASE_URL ||
    'postgresql://root:root@45.159.221.130:7777/root'
  );
}

export class DatabaseConnection {
  private static instance: DatabaseConnection | null = null;
  private pool: Pool;
  private initialized = false;

  private constructor() {
    this.pool = new Pool({
      connectionString: getConnectionString(),
      ssl: false,
    });
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.initializeSchema();
    this.initialized = true;
    logger.debug(`Database connected: ${getConnectionString()}`);
  }

  getPool(): Pool {
    return this.pool;
  }

  private async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(CREATE_TABLES_SQL);
      await this.applyMigrations(client);
      logger.debug('Database schema initialized');
    } catch (error) {
      logger.error(
        `Failed to initialize database: ${(error as Error).message}`,
      );
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyMigrations(client: PoolClient): Promise<void> {
    const currentVersion = await this.getCurrentSchemaVersion(client);

    for (
      let version = currentVersion + 1;
      version <= SCHEMA_VERSION;
      version++
    ) {
      const migration = MIGRATIONS[version];
      if (migration) {
        logger.debug(`Applying migration to version ${version}`);
        await client.query(migration);
        await client.query(
          'INSERT INTO schema_version (version, applied_at) VALUES ($1, $2)',
          [version, Date.now()],
        );
      }
    }
  }

  private async getCurrentSchemaVersion(client: PoolClient): Promise<number> {
    try {
      const result = await client.query(
        'SELECT MAX(version) as version FROM schema_version',
      );
      return result.rows[0]?.version || 0;
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    DatabaseConnection.instance = null;
    logger.debug('Database connection closed');
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async backup(_backupPath?: string): Promise<string> {
    throw new Error(
      'Database backup is not supported with PostgreSQL. Use pg_dump instead.',
    );
  }

  async getStats(): Promise<{
    host: string;
    database: string;
    tables: Record<string, number>;
  }> {
    const url = new URL(getConnectionString());

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

    const tables: Record<string, number> = {};
    for (const table of tableNames) {
      try {
        const result = await this.pool.query(
          `SELECT COUNT(*) as count FROM ${table}`,
        );
        tables[table] = parseInt(result.rows[0].count, 10);
      } catch {
        tables[table] = 0;
      }
    }

    return {
      host: url.host,
      database: url.pathname.slice(1),
      tables,
    };
  }
}

export function getPool(): Pool {
  return DatabaseConnection.getInstance().getPool();
}
