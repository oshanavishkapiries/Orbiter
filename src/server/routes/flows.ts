import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { FlowRefiner } from '../../recorder/refiner/flow-refiner.js';

export async function flowsRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  // 1. List Flows (with Pagination)
  const listFlowsSchema = z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 10)),
    type: z.enum(['raw', 'optimized']).optional(),
  });

  app.get(
    '/',
    {
      schema: {
        querystring: listFlowsSchema,
      },
    },
    async (request, reply) => {
      const { page, limit, type } = request.query;
      const offset = (page - 1) * limit;

      try {
        const pool = DatabaseConnection.getInstance().getPool();

        // 1. Query matching count
        let countQuery = `SELECT COUNT(*) FROM orbiter_flows`;
        const countParams: any[] = [];
        if (type) {
          countQuery += ` WHERE type = $1`;
          countParams.push(type);
        }
        const countResult = await pool.query(countQuery, countParams);
        const totalItems = parseInt(countResult.rows[0].count, 10);

        // 2. Query items
        let query = `SELECT id, session_id as "sessionId", name, type, step_count as "stepCount", created_at as "createdAt" FROM orbiter_flows`;
        const queryParams: any[] = [];
        if (type) {
          query += ` WHERE type = $1`;
          queryParams.push(type);
        }
        query += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        queryParams.push(limit, offset);

        const result = await pool.query(query, queryParams);
        const data = result.rows.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          name: row.name,
          type: row.type,
          stepCount: row.stepCount,
          createdAt: Number(row.createdAt),
        }));

        const totalPages = Math.ceil(totalItems / limit);

        return {
          success: true,
          data,
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

  // 2. Refine Flow
  const refineFlowParamsSchema = z.object({
    id: z.string(),
  });

  const refineFlowBodySchema = z.object({
    mode: z.enum(['auto', 'llm', 'interactive']),
    options: z
      .object({
        removeFailures: z.boolean().optional(),
        mergeSteps: z.boolean().optional(),
        outputPath: z.string().optional(),
        dryRun: z.boolean().optional(),
      })
      .optional(),
  });

  app.post(
    '/:id/refine',
    {
      schema: {
        params: refineFlowParamsSchema,
        body: refineFlowBodySchema,
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { mode, options } = request.body;

      try {
        const refiner = new FlowRefiner();

        const refineOptions = {
          autoClean: mode === 'auto' || (options?.removeFailures ?? true),
          llmOptimize: mode === 'llm' || (options?.mergeSteps ?? true),
          interactive: mode === 'interactive' || (options?.dryRun ?? false),
          outputPath: options?.outputPath,
          dryRun: options?.dryRun ?? false,
        };

        const resultPath = await refiner.refine(id, refineOptions);

        return {
          success: true,
          message: 'Flow refined successfully',
          outputPath: resultPath,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );
}
