import { Command } from 'commander';
import chalk from 'chalk';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { SessionRepository } from '../../memory/database/repositories/session-repository.js';
import { logger } from '../ui/logger.js';

export function sessionCommand() {
  const cmd = new Command('session');

  cmd
    .description('Inspect session memory — view stored steps, DOM snapshots, and extracted data')
    .addCommand(sessionListCommand())
    .addCommand(sessionShowCommand())
    .addCommand(sessionDataCommand());

  return cmd;
}

// ─── orbiter session list ────────────────────────────────────────────────────

function sessionListCommand() {
  return new Command('list')
    .description('List recent automation sessions')
    .option('-n, --limit <number>', 'Number of sessions to show', '15')
    .action(async (options) => {
      const repo = await connectRepo();
      if (!repo) return;

      const limit = parseInt(options.limit, 10);
      const pool = DatabaseConnection.getInstance().getPool();

      const result = await pool.query(
        `SELECT s.id, s.goal, s.model, s.provider, s.status, s.created_at, s.completed_at,
                COUNT(st.id) AS step_count
         FROM sessions s
         LEFT JOIN session_steps st ON st.session_id = s.id
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT $1`,
        [limit],
      );

      if (result.rows.length === 0) {
        console.log(chalk.gray('\n  No sessions recorded yet.\n'));
        return;
      }

      console.log('\n' + chalk.bold('Recent Sessions'));
      console.log(chalk.gray('─'.repeat(72)));

      for (const row of result.rows) {
        const duration = row.completed_at
          ? ((Number(row.completed_at) - Number(row.created_at)) / 1000).toFixed(1) + 's'
          : chalk.yellow('running');

        const statusColor =
          row.status === 'completed'
            ? chalk.green(row.status)
            : row.status === 'failed'
            ? chalk.red(row.status)
            : chalk.yellow(row.status);

        const created = new Date(Number(row.created_at)).toLocaleString();

        console.log(
          `\n  ${chalk.cyan(row.id)}  ${statusColor}  ${chalk.gray(duration)}`,
        );
        console.log(`  Goal:    ${chalk.white(row.goal.slice(0, 70))}${row.goal.length > 70 ? '…' : ''}`);
        console.log(
          `  Model:   ${chalk.gray(row.provider + '/' + row.model)}   Steps: ${chalk.cyan(row.step_count)}   ${chalk.gray(created)}`,
        );
      }

      console.log('\n' + chalk.gray('Use: orbiter session show <id>  to inspect a session'));
      console.log('');
    });
}

// ─── orbiter session show <id> ───────────────────────────────────────────────

function sessionShowCommand() {
  return new Command('show')
    .description('Show all steps recorded for a session')
    .argument('<session-id>', 'Session ID (from orbiter session list)')
    .option('--full', 'Show full result JSON for each step (verbose)')
    .action(async (sessionId, options) => {
      const repo = await connectRepo();
      if (!repo) return;

      // Session header
      const pool = DatabaseConnection.getInstance().getPool();
      const sessionRow = await pool.query(
        'SELECT * FROM sessions WHERE id = $1',
        [sessionId],
      );

      if (sessionRow.rows.length === 0) {
        logger.error(`Session not found: ${sessionId}`);
        return;
      }

      const s = sessionRow.rows[0];
      const duration = s.completed_at
        ? ((Number(s.completed_at) - Number(s.created_at)) / 1000).toFixed(1) + 's'
        : 'still running';

      console.log('\n' + chalk.bold('Session Details'));
      console.log(chalk.gray('─'.repeat(72)));
      console.log(`  ID:     ${chalk.cyan(s.id)}`);
      console.log(`  Goal:   ${chalk.white(s.goal)}`);
      console.log(`  Model:  ${chalk.gray(s.provider + '/' + s.model)}`);
      console.log(
        `  Status: ${s.status === 'completed' ? chalk.green(s.status) : chalk.red(s.status)}  (${duration})`,
      );
      console.log(`  Date:   ${chalk.gray(new Date(Number(s.created_at)).toLocaleString())}`);

      // Steps
      const steps = await repo.getStepHistory(sessionId);

      console.log('\n' + chalk.bold(`Steps (${steps.length} total)`));
      console.log(chalk.gray('─'.repeat(72)));

      for (const step of steps) {
        const icon = step.success ? chalk.green('✓') : chalk.red('✗');
        const dur = step.duration ? chalk.gray(`${step.duration}ms`) : '';
        console.log(
          `  ${icon} Step ${String(step.stepNumber).padStart(2, ' ')}  ${chalk.cyan(step.toolName.padEnd(25))} ${dur}`,
        );
        console.log(`         ${chalk.gray(step.resultSummary)}`);

        if (options.full) {
          const full = await repo.getFullStepResult(sessionId, step.stepNumber);
          if (full) {
            console.log(chalk.dim('         ' + JSON.stringify(full).slice(0, 200)));
          }
        }
      }

      // DOM snapshots summary
      const domResult = await pool.query(
        'SELECT COUNT(*) AS cnt FROM session_dom_snapshots WHERE session_id = $1',
        [sessionId],
      );
      const domCount = domResult.rows[0]?.cnt ?? 0;

      // Collected data summary
      const dataResult = await pool.query(
        'SELECT COUNT(*) AS cnt FROM session_collected_data WHERE session_id = $1',
        [sessionId],
      );
      const dataCount = dataResult.rows[0]?.cnt ?? 0;

      console.log('\n' + chalk.bold('Memory'));
      console.log(chalk.gray('─'.repeat(72)));
      console.log(`  DOM snapshots stored:    ${chalk.cyan(domCount)}`);
      console.log(`  Data extraction records: ${chalk.cyan(dataCount)}`);

      if (Number(dataCount) > 0) {
        console.log('\n' + chalk.gray('  Use: orbiter session data ' + sessionId + '  to view extracted data'));
      }

      console.log('');
    });
}

// ─── orbiter session data <id> ───────────────────────────────────────────────

function sessionDataCommand() {
  return new Command('data')
    .description('Show all data extracted during a session')
    .argument('<session-id>', 'Session ID')
    .option('--json', 'Output raw JSON')
    .action(async (sessionId, options) => {
      const repo = await connectRepo();
      if (!repo) return;

      const records = await repo.getAllCollectedData(sessionId);

      if (records.length === 0) {
        console.log(chalk.gray('\n  No data was extracted in this session.\n'));
        return;
      }

      if (options.json) {
        const allData = records.flatMap((r) =>
          Array.isArray(r.data) ? r.data : [r.data],
        );
        console.log(JSON.stringify(allData, null, 2));
        return;
      }

      console.log('\n' + chalk.bold('Extracted Data'));
      console.log(chalk.gray('─'.repeat(72)));

      for (const record of records) {
        const items = Array.isArray(record.data) ? record.data : [record.data];
        console.log(
          `\n  ${chalk.cyan('Step ' + record.stepNumber)}  ${chalk.gray(record.toolName)}  ${chalk.yellow(items.length + ' item(s)')}`,
        );

        for (const [i, item] of items.slice(0, 5).entries()) {
          if (typeof item === 'string') {
            console.log(`    ${i + 1}. ${item.slice(0, 100)}`);
          } else if (typeof item === 'object') {
            const pairs = Object.entries(item)
              .map(([k, v]) => `${k}: ${String(v ?? '').slice(0, 40)}`)
              .join('  |  ');
            console.log(`    ${i + 1}. ${pairs}`);
          }
        }

        if (items.length > 5) {
          console.log(chalk.gray(`    ... and ${items.length - 5} more`));
        }
      }

      const total = records.reduce(
        (n, r) => n + (Array.isArray(r.data) ? r.data.length : 1),
        0,
      );
      console.log(
        '\n' + chalk.bold(`Total: ${total} items across ${records.length} extraction(s)`),
      );
      console.log(
        chalk.gray('  Use --json flag to get raw JSON output'),
      );
      console.log('');
    });
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function connectRepo(): Promise<SessionRepository | null> {
  try {
    await DatabaseConnection.getInstance().initialize();
    return new SessionRepository();
  } catch (err) {
    logger.error(`Cannot connect to database: ${(err as Error).message}`);
    return null;
  }
}
