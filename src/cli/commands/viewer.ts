import http from 'http';
import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { logger } from '../ui/logger.js';
import { getViewerHtml } from '../viewer/template.js';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { SessionRepository } from '../../memory/database/repositories/session-repository.js';

export function viewerCommand() {
  const cmd = new Command('viewer');

  cmd
    .description('Open the LLM chat viewer in your browser')
    .option('-p, --port <number>', 'Port to listen on', '4040')
    .option('--no-open', 'Do not auto-open the browser')
    .action(async (options) => {
      const port = parseInt(options.port, 10);

      let repo: SessionRepository | null = null;
      try {
        await DatabaseConnection.getInstance().initialize();
        repo = new SessionRepository();
        logger.info('Connected to database');
      } catch {
        logger.warn('Database unavailable — falling back to log file mode');
      }

      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${port}`);
        const pathname = url.pathname;

        try {
          // ── CORS headers (local only) ──────────────────────────
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'no-cache');

          // ── Routes ─────────────────────────────────────────────

          // GET / → HTML viewer
          if (pathname === '/' || pathname === '/index.html') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(getViewerHtml());
            return;
          }

          // GET /api/sessions → list sessions (DB or log files)
          if (pathname === '/api/sessions') {
            const sessions = await listSessions(repo);
            json(res, sessions);
            return;
          }

          // GET /api/interactions/:sessionId → LLM interactions
          const interMatch = pathname.match(/^\/api\/interactions\/(.+)$/);
          if (interMatch) {
            const sessionId = decodeURIComponent(interMatch[1]);
            const interactions = await getInteractions(repo, sessionId);
            json(res, interactions);
            return;
          }

          // 404
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        } catch (err) {
          logger.debug(`Viewer request error: ${(err as Error).message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });

      server.listen(port, '127.0.0.1', () => {
        const url = `http://localhost:${port}`;
        logger.info(`Orbiter Viewer running at ${url}`);
        logger.info('Press Ctrl-C to stop');

        if (options.open !== false) {
          openBrowser(url);
        }
      });

      process.on('SIGINT', () => {
        server.close();
        process.exit(0);
      });
    });

  return cmd;
}

// ── Data helpers ──────────────────────────────────────────────

async function listSessions(repo: SessionRepository | null) {
  if (repo) {
    try {
      return await repo.listSessions(100);
    } catch { /* fall through to file-based */ }
  }

  // Fallback: read JSONL log files
  const logDir = path.resolve('./data/logs');
  if (!fs.existsSync(logDir)) return [];

  const files = fs.readdirSync(logDir).filter((f) => f.startsWith('llm-chat-') && f.endsWith('.jsonl'));
  return files.map((f) => {
    const sessionId = f.replace('llm-chat-', '').replace('.jsonl', '');
    const stat = fs.statSync(path.join(logDir, f));
    return {
      id: sessionId,
      goal: sessionId,
      model: null,
      provider: null,
      status: 'completed',
      createdAt: stat.birthtimeMs,
    };
  }).sort((a, b) => b.createdAt - a.createdAt);
}

async function getInteractions(repo: SessionRepository | null, sessionId: string) {
  if (repo) {
    try {
      return await repo.getLLMInteractions(sessionId);
    } catch { /* fall through */ }
  }

  // Fallback: read JSONL file
  const logDir = path.resolve('./data/logs');
  const candidates = [
    path.join(logDir, `llm-chat-${sessionId}.jsonl`),
    path.join(logDir, `${sessionId}.jsonl`),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf-8').trim().split('\n').filter(Boolean);
      return lines.map((line) => {
        try {
          const entry = JSON.parse(line);
          return {
            id: entry.callIndex,
            sessionId: entry.sessionId,
            callIndex: entry.callIndex,
            fullMessages: entry.messages ?? [],
            responseContent: entry.response?.content ?? null,
            toolCalls: entry.response?.toolCalls ?? null,
            finishReason: entry.response?.finishReason ?? null,
            promptTokens: entry.response?.usage?.promptTokens ?? 0,
            completionTokens: entry.response?.usage?.completionTokens ?? 0,
            totalTokens: entry.response?.usage?.totalTokens ?? 0,
            durationMs: entry.durationMs ?? 0,
            timestamp: entry.timestamp ?? 0,
          };
        } catch {
          return null;
        }
      }).filter(Boolean);
    }
  }

  return [];
}

function json(res: http.ServerResponse, data: any) {
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function openBrowser(url: string) {
  const { platform } = process;
  const cmd =
    platform === 'win32' ? `start "" "${url}"` :
    platform === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;

  import('child_process').then(({ exec }) => exec(cmd)).catch(() => {});
}
