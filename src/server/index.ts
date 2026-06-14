import 'dotenv/config';
import { createServer } from './app.js';
import { DatabaseConnection } from '../memory/database/connection.js';
import { logger } from '../cli/ui/logger.js';

const PORT = parseInt(process.env.PORT || '4040', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  try {
    // 1. Initialize Database connection
    logger.info('Connecting to database...');
    await DatabaseConnection.getInstance().initialize();
    logger.info('Database connected successfully.');

    // 2. Start Fastify server
    const server = createServer();
    await server.listen({ port: PORT, host: HOST });
    logger.info(`Orbiter REST API server running at http://${HOST}:${PORT}`);

    // Handle shutdown signals
    const shutdown = async () => {
      logger.info('Shutting down server...');
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
