import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { SessionRepository } from '../../memory/database/repositories/session-repository.js';
import { enqueueJob } from '../worker.js';
import { eventBus } from '../event-bus.js';

export async function executionRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  // 1. List Sessions (with Pagination)
  const listSessionsSchema = z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 15)),
  });

  app.get(
    '/sessions',
    {
      schema: {
        querystring: listSessionsSchema,
      },
    },
    async (request, reply) => {
      const { page, limit } = request.query;
      const offset = (page - 1) * limit;

      try {
        const pool = DatabaseConnection.getInstance().getPool();

        // 1. Query total sessions count
        const countResult = await pool.query('SELECT COUNT(*) FROM sessions');
        const totalItems = parseInt(countResult.rows[0].count, 10);

        // 2. Query sessions list with step counts
        const query = `
          SELECT s.id, s.goal, s.model, s.provider, s.status, s.created_at as "createdAt", s.completed_at as "completedAt",
                 COUNT(st.id) AS "stepCount"
          FROM sessions s
          LEFT JOIN session_steps st ON st.session_id = s.id
          GROUP BY s.id
          ORDER BY s.created_at DESC
          LIMIT $1 OFFSET $2
        `;
        const result = await pool.query(query, [limit, offset]);
        const sessions = result.rows.map((row) => ({
          id: row.id,
          goal: row.goal,
          model: row.model,
          provider: row.provider,
          status: row.status,
          stepCount: parseInt(row.stepCount, 10),
          createdAt: Number(row.createdAt),
          completedAt: row.completedAt ? Number(row.completedAt) : null,
        }));

        const totalPages = Math.ceil(totalItems / limit);

        return {
          success: true,
          sessions,
          pagination: {
            currentPage: page,
            totalPages,
            totalItems,
            hasNext: page < totalPages,
          },
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 2. Get Session Details
  const sessionParamsSchema = z.object({
    id: z.string(),
  });

  const sessionQuerySchema = z.object({
    full: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  });

  app.get(
    '/sessions/:id',
    {
      schema: {
        params: sessionParamsSchema,
        querystring: sessionQuerySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { full } = request.query;

      try {
        const pool = DatabaseConnection.getInstance().getPool();

        // 1. Query session metadata
        const sessionResult = await pool.query(
          'SELECT * FROM sessions WHERE id = $1',
          [id],
        );
        if (sessionResult.rows.length === 0) {
          return reply.status(404).send({
            success: false,
            error: `Session not found: ${id}`,
          });
        }

        const s = sessionResult.rows[0];

        // 2. Query steps
        const repo = new SessionRepository();
        const steps = await repo.getStepHistory(id);

        const formattedSteps = await Promise.all(
          steps.map(async (step) => {
            let fullResult = {};
            if (full) {
              const fullRes = await repo.getFullStepResult(id, step.stepNumber);
              if (fullRes) fullResult = fullRes;
            }
            return {
              stepNumber: step.stepNumber,
              toolName: step.toolName,
              resultSummary: step.resultSummary,
              success: step.success,
              duration: step.duration,
              fullResult,
            };
          }),
        );

        // 3. Query extra counts
        const domResult = await pool.query(
          'SELECT COUNT(*) AS cnt FROM session_dom_snapshots WHERE session_id = $1',
          [id],
        );
        const collectedResult = await pool.query(
          'SELECT COUNT(*) AS cnt FROM session_collected_data WHERE session_id = $1',
          [id],
        );

        return {
          success: true,
          session: {
            id: s.id,
            goal: s.goal,
            model: s.model,
            provider: s.provider,
            status: s.status,
            createdAt: Number(s.created_at),
            completedAt: s.completed_at ? Number(s.completed_at) : null,
            steps: formattedSteps,
            domSnapshotsCount: parseInt(domResult.rows[0]?.cnt ?? '0', 10),
            collectedDataCount: parseInt(
              collectedResult.rows[0]?.cnt ?? '0',
              10,
            ),
          },
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 3. Get Session Extracted Data
  const sessionDataQuerySchema = z.object({
    json: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  });

  app.get(
    '/sessions/:id/data',
    {
      schema: {
        params: sessionParamsSchema,
        querystring: sessionDataQuerySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { json } = request.query;

      try {
        const repo = new SessionRepository();
        const records = await repo.getAllCollectedData(id);

        if (json) {
          const allData = records.flatMap((r) =>
            Array.isArray(r.data) ? r.data : [r.data],
          );
          return allData;
        }

        const formattedRecords = records.map((record) => {
          const items = Array.isArray(record.data)
            ? record.data
            : [record.data];
          return {
            stepNumber: record.stepNumber,
            toolName: record.toolName,
            itemCount: items.length,
            data: items,
          };
        });

        return {
          success: true,
          records: formattedRecords,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 4. Start Task Execution (Async Run)
  const runTaskSchema = z.object({
    prompt: z.string().min(5),
    model: z.string().optional(),
    profile: z.string().optional(),
    headless: z.boolean().optional(),
    maxSteps: z.number().optional(),
    record: z.boolean().optional(),
    enhance: z.boolean().optional(),
    highlight: z.boolean().optional(),
  });

  app.post(
    '/run',
    {
      schema: {
        body: runTaskSchema,
      },
    },
    async (request, reply) => {
      const body = request.body;

      try {
        // Pre-allocate session
        const repo = new SessionRepository();
        const userId = (request as any).user?.id;
        const sessionId = await repo.createSession(
          body.prompt,
          body.model,
          'openrouter',
          userId,
        );

        // Queue background job
        await enqueueJob('run', sessionId, body);

        return reply.status(202).send({
          success: true,
          sessionId,
          status: 'queued',
          message: 'Task execution started in background',
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 5. Replay Flow
  const replayFlowSchema = z.object({
    flowPath: z.string().min(1),
    params: z.record(z.string(), z.any()).optional(),
    headless: z.boolean().optional(),
    profile: z.string().optional(),
    stopOnError: z.boolean().optional(),
    screenshotSteps: z.boolean().optional(),
    skipSteps: z.array(z.number()).optional(),
  });

  app.post(
    '/replay',
    {
      schema: {
        body: replayFlowSchema,
      },
    },
    async (request, reply) => {
      const body = request.body;

      try {
        const repo = new SessionRepository();
        const userId = (request as any).user?.id;
        const sessionId = await repo.createSession(
          `Replay flow: ${body.flowPath}`,
          undefined,
          'replayer',
          userId,
        );

        // Queue background job
        await enqueueJob('replay', sessionId, body);

        return reply.status(202).send({
          success: true,
          sessionId,
          status: 'queued',
          message: 'Flow replay started in background',
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 6. Get Live Execution Stream (SSE)
  const streamParamsSchema = z.object({
    sessionId: z.string(),
  });

  app.get(
    '/stream/:sessionId',
    {
      schema: {
        params: streamParamsSchema,
      },
    },
    async (request, reply) => {
      const { sessionId } = request.params;

      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      // Write initial establish connection message
      reply.raw.write(
        `event: connected\ndata: ${JSON.stringify({ sessionId, timestamp: Date.now() })}\n\n`,
      );

      const onStep = (data: any) => {
        reply.raw.write(`event: step\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const onLog = (data: any) => {
        reply.raw.write(`event: log\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const onScreenshot = (data: any) => {
        reply.raw.write(`event: screenshot\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const onStatus = (data: any) => {
        reply.raw.write(`event: status\ndata: ${JSON.stringify(data)}\n\n`);
      };

      eventBus.on(`step:${sessionId}`, onStep);
      eventBus.on(`log:${sessionId}`, onLog);
      eventBus.on(`screenshot:${sessionId}`, onScreenshot);
      eventBus.on(`status:${sessionId}`, onStatus);

      request.raw.on('close', () => {
        eventBus.off(`step:${sessionId}`, onStep);
        eventBus.off(`log:${sessionId}`, onLog);
        eventBus.off(`screenshot:${sessionId}`, onScreenshot);
        eventBus.off(`status:${sessionId}`, onStatus);
      });
    },
  );

  // 7. Get Execution and Token Stats
  app.get('/stats', async (request, reply) => {
    try {
      const pool = DatabaseConnection.getInstance().getPool();

      // Query sessions count by status
      const sessionsCountRes = await pool.query(`
        SELECT status, COUNT(*) as cnt 
        FROM sessions 
        GROUP BY status
      `);
      const sessionStats = {
        total: 0,
        running: 0,
        completed: 0,
        failed: 0,
        queued: 0,
      };
      sessionsCountRes.rows.forEach(row => {
        const count = parseInt(row.cnt, 10);
        sessionStats.total += count;
        if (row.status === 'running') sessionStats.running = count;
        else if (row.status === 'completed') sessionStats.completed = count;
        else if (row.status === 'failed') sessionStats.failed = count;
        else if (row.status === 'queued') sessionStats.queued = count;
      });

      // Query token summary
      const tokenSummaryRes = await pool.query(`
        SELECT COALESCE(SUM(total_tokens), 0) AS "totalTokens",
               COALESCE(SUM(prompt_tokens), 0) AS "promptTokens",
               COALESCE(SUM(completion_tokens), 0) AS "completionTokens"
        FROM llm_interactions
      `);
      const tokenStats = {
        total: parseInt(tokenSummaryRes.rows[0].totalTokens, 10),
        prompt: parseInt(tokenSummaryRes.rows[0].promptTokens, 10),
        completion: parseInt(tokenSummaryRes.rows[0].completionTokens, 10),
      };

      // Query token activity logs over time
      const activityRes = await pool.query(`
        SELECT date_trunc('hour', to_timestamp(timestamp / 1000)) as hr,
               SUM(total_tokens) as tokens
        FROM llm_interactions
        GROUP BY hr
        ORDER BY hr ASC
        LIMIT 24
      `);
      const activity = activityRes.rows.map(row => ({
        time: new Date(row.hr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tokens: parseInt(row.tokens, 10),
      }));

      return {
        success: true,
        sessionStats,
        tokenStats,
        activity,
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });
}

