import { DatabaseConnection } from '../memory/database/connection.js';
import { sessionLocalStorage } from './session-storage.js';
import { eventBus } from './event-bus.js';
import { ExecutionContext } from '../core/execution-context.js';
import { TaskExecutor } from '../core/executor.js';
import { PromptEnhancer } from '../core/prompt-enhancer.js';
import { LLMFactory } from '../llm/factory.js';
import { initializeTools } from '../tools/index.js';
import { McpClient } from '../mcp/client.js';
import { config, getUserConfig } from '../config/index.js';
import { FlowReplayer } from '../recorder/replayer.js';
import { logger } from '../cli/ui/logger.js';

let workerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

// 1. Ensure jobs table exists and clean up dangling executions from crashes
export async function initializeWorkerSchema(): Promise<void> {
  const pool = DatabaseConnection.getInstance().getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orbiter_jobs (
      id SERIAL PRIMARY KEY,
      type TEXT NOT NULL,
      session_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      error TEXT,
      created_at BIGINT NOT NULL,
      started_at BIGINT,
      completed_at BIGINT
    );
    CREATE INDEX IF NOT EXISTS idx_orbiter_jobs_status ON orbiter_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_orbiter_jobs_session_id ON orbiter_jobs(session_id);
  `);

  logger.info('Checking for dangling background jobs and sessions from a previous crash...');
  const now = Date.now();

  // 1. Mark any running jobs as failed
  const jobsCleanup = await pool.query(
    `UPDATE orbiter_jobs 
     SET status = 'failed', error = 'Backend server crashed or restarted', completed_at = $1 
     WHERE status = 'running'`,
    [now]
  );
  if (jobsCleanup.rowCount && jobsCleanup.rowCount > 0) {
    logger.info(`Marked ${jobsCleanup.rowCount} dangling background jobs as failed.`);
  }

  // 2. Mark running sessions as failed (unless they are linked to a still pending job)
  const sessionsCleanup = await pool.query(
    `UPDATE orbiter_sessions 
     SET status = 'failed', completed_at = $1 
     WHERE status = 'running' 
       AND id NOT IN (
         SELECT DISTINCT session_id 
         FROM orbiter_jobs 
         WHERE status = 'pending'
       )`,
    [now]
  );
  if (sessionsCleanup.rowCount && sessionsCleanup.rowCount > 0) {
    logger.info(`Marked ${sessionsCleanup.rowCount} dangling sessions as failed.`);
  }
}

// 2. Enqueue a new background job
export async function enqueueJob(
  type: 'run' | 'replay',
  sessionId: string,
  payload: any,
): Promise<number> {
  const pool = DatabaseConnection.getInstance().getPool();
  const result = await pool.query(
    `INSERT INTO orbiter_jobs (type, session_id, payload, status, created_at)
     VALUES ($1, $2, $3, 'pending', $4) RETURNING id`,
    [type, sessionId, JSON.stringify(payload), Date.now()],
  );

  // Trigger worker check immediately
  triggerWorker();

  return result.rows[0].id;
}

// 3. Worker Polling & Execution Loop
export function startWorker() {
  if (workerInterval) return;

  // Poll every 3 seconds
  workerInterval = setInterval(async () => {
    await processNextJob();
  }, 3000);

  logger.info('Background job worker started.');
}

export function stopWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
}

export function triggerWorker() {
  processNextJob().catch((err) => {
    logger.error(`Error triggering worker: ${err.message}`);
  });
}

async function processNextJob(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pool = DatabaseConnection.getInstance().getPool();

    // Atomically claim the next pending job using FOR UPDATE SKIP LOCKED
    const claimResult = await pool.query(
      `
      UPDATE orbiter_jobs
      SET status = 'running', started_at = $1
      WHERE id = (
        SELECT id FROM orbiter_jobs
        WHERE status = 'pending'
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `,
      [Date.now()],
    );

    if (claimResult.rows.length === 0) {
      isProcessing = false;
      return;
    }

    const job = claimResult.rows[0];
    const { session_id: sessionId, type, payload } = job;

    logger.info(
      `Processing background job ${job.id} (${type}) for session ${sessionId}...`,
    );
    eventBus.emitStatus(sessionId, { status: 'running' });

    // Run the task inside AsyncLocalStorage context
    await sessionLocalStorage.run(sessionId, async () => {
      try {
        if (type === 'run') {
          await runTask(sessionId, payload);
        } else if (type === 'replay') {
          await replayFlow(sessionId, payload);
        }

        // Update job as completed
        await pool.query(
          `UPDATE orbiter_jobs SET status = 'completed', completed_at = $1 WHERE id = $2`,
          [Date.now(), job.id],
        );
        eventBus.emitStatus(sessionId, { status: 'completed' });
        logger.info(`Job ${job.id} completed successfully.`);
      } catch (jobErr) {
        const errorMsg = (jobErr as Error).message || String(jobErr);
        logger.error(`Job ${job.id} failed: ${errorMsg}`);

        await pool.query(
          `UPDATE orbiter_jobs SET status = 'failed', error = $1, completed_at = $2 WHERE id = $3`,
          [errorMsg, Date.now(), job.id],
        );
        eventBus.emitStatus(sessionId, { status: 'failed', error: errorMsg });
      }
    });
  } catch (err) {
    logger.error(`Worker execution error: ${(err as Error).message}`);
  } finally {
    isProcessing = false;

    // Check if there are more jobs immediately
    const pool = DatabaseConnection.getInstance().getPool();
    const pendingCheck = await pool.query(
      `SELECT COUNT(*) FROM orbiter_jobs WHERE status = 'pending'`,
    );
    if (parseInt(pendingCheck.rows[0].count, 10) > 0) {
      setImmediate(() => processNextJob());
    }
  }
}

// Helper: executes task run
async function runTask(sessionId: string, payload: any): Promise<void> {
  const {
    prompt,
    model,
    profile,
    headless,
    maxSteps,
    record,
    enhance,
    highlight,
  } = payload;
  const pool = DatabaseConnection.getInstance().getPool();
  const sessionRes = await pool.query('SELECT user_id FROM orbiter_sessions WHERE id = $1', [sessionId]);
  const userId = sessionRes.rows[0]?.user_id;
  const cfg = userId ? await getUserConfig(userId) : config();

  const context = new ExecutionContext();
  const mcpClient = new McpClient();

  try {
    initializeTools();

    const mcpOptions = {
      headless: headless ?? cfg.browser.headless,
      userDataDir: profile ?? cfg.browser.profilePath,
      executablePath: cfg.browser.executablePath,
      browser: (cfg.browser.channel as any) ?? undefined,
      viewport: cfg.browser.viewport,
    };

    await mcpClient.connect(mcpOptions);
    context.setMcpClient(mcpClient);

    const llm = LLMFactory.create(undefined, model, cfg);
    await llm.loadCapabilities();

    let activePrompt = prompt;

    if (enhance !== false && cfg.promptEnhancer.enabled) {
      const enhancer = new PromptEnhancer(llm);
      const enhanceResult = await enhancer.enhance(prompt);
      activePrompt = enhanceResult.enhanced;
    }

    const modelInfo = (llm as any).getModelInfo?.() || {
      name: cfg.llm.model,
      provider: cfg.llm.provider,
    };

    const executor = new TaskExecutor(
      llm,
      context,
      activePrompt,
      modelInfo.provider,
      modelInfo.name,
      !!highlight,
    );

    // Override the executor's internal sessionId to match our pre-allocated one
    (executor as any).sessionId = sessionId;
    (executor as any).sessionRepo = new (
      await import('../memory/database/repositories/session-repository.js')
    ).SessionRepository();
    context.setSession((executor as any).sessionRepo, sessionId);

    if (record === false) {
      cfg.recording.enabled = false;
    }

    const result = await executor.execute(maxSteps);
    if (!result.success) {
      throw new Error(result.error || 'Execution failed');
    }
  } finally {
    await mcpClient.disconnect();
    await context.cleanup();
  }
}

// Helper: executes flow replay
async function replayFlow(sessionId: string, payload: any): Promise<void> {
  const {
    flowPath,
    params,
    headless,
    profile,
    stopOnError,
    screenshotSteps,
    skipSteps,
  } = payload;

  const pool = DatabaseConnection.getInstance().getPool();
  const sessionRes = await pool.query('SELECT user_id FROM orbiter_sessions WHERE id = $1', [sessionId]);
  const userId = sessionRes.rows[0]?.user_id;
  const cfg = userId ? await getUserConfig(userId) : config();

  const replayer = new FlowReplayer();

  try {
    // Override the replayer's internal session logging or hook it
    await replayer.replay(flowPath, {
      parameters: params,
      headless,
      profilePath: profile,
      stopOnError,
      screenshotOnStep: screenshotSteps,
      skipSteps: skipSteps || [],
      config: cfg,
    });
  } finally {
    await replayer.cleanup();
  }
}
