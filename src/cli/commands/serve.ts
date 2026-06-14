import { Command } from 'commander';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger } from '../ui/logger.js';

export function serveCommand() {
  const cmd = new Command('serve');

  cmd
    .description('Start the Orbiter REST API server')
    .option('-p, --port <number>', 'Port to run the REST API server on', '4040')
    .option('-h, --host <ip>', 'Host to run the REST API server on', '0.0.0.0')
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const host = options.host;

      // Ensure build folder exists
      const distServerIndex = path.resolve('./dist/server/index.js');
      if (!fs.existsSync(distServerIndex)) {
        logger.error(
          'Compiled server not found. Please run "npm run build" first.',
        );
        process.exit(1);
      }

      logger.info(
        `Starting Orbiter REST API server on http://${host}:${port}...`,
      );

      const child = spawn('node', [distServerIndex], {
        env: {
          ...process.env,
          PORT: String(port),
          HOST: host,
        },
        stdio: 'inherit',
      });

      // Handle shutdown signals in the parent CLI process
      const shutdown = () => {
        child.kill('SIGTERM');
        process.exit(0);
      };

      process.once('SIGINT', shutdown);
      process.once('SIGTERM', shutdown);

      child.on('close', (code) => {
        if (code !== 0 && code !== null) {
          logger.error(`REST API server exited with code ${code}`);
        }
        process.exit(code ?? 0);
      });
    });

  return cmd;
}
