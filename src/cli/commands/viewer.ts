import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { logger } from '../ui/logger.js';

export function viewerCommand() {
  const cmd = new Command('viewer');

  cmd
    .description('Open the Orbiter web dashboard in your browser')
    .option('-p, --port <number>', 'Port to run the web app on', '4040')
    .option('--no-open', 'Do not auto-open the browser')
    .option(
      '--production',
      'Serve the pre-built app (next start) instead of dev server',
    )
    .action(async (options) => {
      const port = parseInt(options.port, 10);
      const webDir = path.resolve('./web');
      const dataDir = path.resolve('./data');
      const orbiterRoot = path.resolve('.');

      // ── Prerequisite checks ────────────────────────────────────────
      if (!fs.existsSync(webDir)) {
        logger.error('Web app directory not found: ./web');
        logger.info(
          'Make sure you are running this command from the Orbiter project root.',
        );
        process.exit(1);
      }

      if (!fs.existsSync(path.join(webDir, 'node_modules'))) {
        logger.error('Web app dependencies not installed.');
        logger.info('Run:  cd web && pnpm install');
        process.exit(1);
      }

      // Determine dev vs production mode
      const isBuilt = fs.existsSync(path.join(webDir, '.next', 'BUILD_ID'));
      const useProduction = options.production && isBuilt;

      if (options.production && !isBuilt) {
        logger.warn(
          'No production build found. Run "cd web && pnpm build" first. Falling back to dev mode.',
        );
      }

      const mode = useProduction ? 'start' : 'dev';
      const url = `http://localhost:${port}`;

      // ── Environment vars passed to Next.js ─────────────────────────
      // Strip --localstorage-file from NODE_OPTIONS — Node.js 22+ defines a broken
      // localStorage when this flag is set without a valid path, which crashes Next.js SSR.
      const cleanNodeOptions = (process.env.NODE_OPTIONS ?? '')
        .split(/\s+/)
        .filter((f) => f && !f.startsWith('--localstorage-file'))
        .join(' ')
        .trim();

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        NODE_OPTIONS: cleanNodeOptions || undefined,
        ORBITER_DATA_DIR: dataDir,
        ORBITER_ROOT: orbiterRoot,
        PORT: String(port),
      };

      // Pass DB URL if available
      if (process.env.DATABASE_URL) {
        env.DATABASE_URL = process.env.DATABASE_URL;
      }

      logger.info(`Starting Orbiter web dashboard (${mode} mode)…`);
      logger.info(`URL: ${url}`);

      // ── Spawn Next.js ──────────────────────────────────────────────
      const child = spawn('npx', ['next', mode, '--port', String(port)], {
        cwd: webDir,
        env,
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      let browserOpened = false;

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        process.stdout.write(text);

        // Detect when the server is ready and open the browser
        if (
          !browserOpened &&
          (text.includes('Local:') ||
            text.includes('Ready in') ||
            text.includes('ready started'))
        ) {
          browserOpened = true;
          if (options.open !== false) {
            setTimeout(() => openBrowser(url), 500);
          }
          logger.info(`Orbiter dashboard is ready at ${url}`);
          logger.info('Press Ctrl-C to stop.');
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(data);
      });

      child.on('error', (err) => {
        logger.error(`Failed to start web app: ${err.message}`);
        logger.info(
          'Make sure Node.js and pnpm are installed and you have run "cd web && pnpm install".',
        );
        process.exit(1);
      });

      child.on('close', (code) => {
        if (code !== 0 && code !== null) {
          logger.error(`Web app exited with code ${code}`);
        }
        process.exit(code ?? 0);
      });

      process.on('SIGINT', () => {
        child.kill('SIGINT');
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        child.kill('SIGTERM');
        process.exit(0);
      });
    });

  return cmd;
}

function openBrowser(url: string) {
  const { platform } = process;
  const cmd =
    platform === 'win32'
      ? `start "" "${url}"`
      : platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  import('child_process').then(({ exec }) => exec(cmd)).catch(() => {});
}
