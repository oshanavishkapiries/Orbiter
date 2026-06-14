import 'dotenv/config';
import { createServer } from './app.js';
import { DatabaseConnection } from '../memory/database/connection.js';
import { logger } from '../cli/ui/logger.js';
import { config } from '../config/index.js';
import { DataRepository } from '../memory/database/repositories/data-repository.js';
import { getOrGenerateKeys } from './jwt.js';

const PORT = parseInt(process.env.PORT || '4040', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  try {
    // 1. Initialize Database connection
    logger.info('Connecting to database...');
    await DatabaseConnection.getInstance().initialize();
    logger.info('Database connected successfully.');

    // Seed settings from config
    logger.info('Checking settings seeds...');
    const dataRepo = new DataRepository();
    await dataRepo.seedSettings(config());
    logger.info('Settings checked/seeded successfully.');

    // Seed default admin user from environment or fallbacks
    const pool = DatabaseConnection.getInstance().getPool();
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

    const checkRes = await pool.query('SELECT * FROM users WHERE username = $1', [adminUsername]);
    let adminUserId = '';
    if (checkRes.rows.length === 0) {
      logger.info(`Seeding default admin user: ${adminUsername}...`);
      adminUserId = `usr_${Math.random().toString(36).substring(2, 12)}`;
      await pool.query(
        'INSERT INTO users (id, username, password, created_at) VALUES ($1, $2, $3, $4)',
        [adminUserId, adminUsername, adminPassword, Date.now()]
      );
      logger.info('Admin user seeded successfully.');
    } else {
      adminUserId = checkRes.rows[0].id;
      if (checkRes.rows[0].password !== adminPassword) {
        logger.info(`Updating admin user password to match environment config...`);
        await pool.query(
          'UPDATE users SET password = $1 WHERE username = $2',
          [adminPassword, adminUsername]
        );
        logger.info('Admin user password updated.');
      } else {
        logger.info(`Admin user "${adminUsername}" already exists and matches configuration.`);
      }
    }

    // Seed/check admin user settings
    logger.info(`Checking settings seeds for admin user "${adminUsername}"...`);
    await dataRepo.seedUserSettings(adminUserId, config());
    logger.info(`Admin user settings checked/seeded successfully.`);

    // Seed/check JWT keys
    logger.info('Checking JWT cryptographic keys...');
    await getOrGenerateKeys();
    logger.info('JWT keys checked/initialized successfully.');

    // Initialize worker schemas and start worker
    const { initializeWorkerSchema, startWorker, stopWorker } =
      await import('./worker.js');
    await initializeWorkerSchema();
    startWorker();

    // 2. Start Fastify server
    const server = createServer();
    await server.listen({ port: PORT, host: HOST });
    logger.info(`Orbiter REST API server running at http://${HOST}:${PORT}`);

    // Handle shutdown signals
    const shutdown = async () => {
      logger.info('Shutting down server...');
      stopWorker();
      await server.close();
      await DatabaseConnection.getInstance().close();
      logger.info('Shutdown complete.');
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.error(`Fatal server error: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
