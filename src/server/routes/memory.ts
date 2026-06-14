import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getMemoryManager } from '../../memory/manager.js';

export async function memoryRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  // 1. Retrieve Selector Memories
  const retrieveSelectorsSchema = z.object({
    domain: z.string().min(1),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
  });

  app.get(
    '/selectors',
    {
      schema: {
        querystring: retrieveSelectorsSchema,
      },
    },
    async (request, reply) => {
      const { domain, limit } = request.query;

      try {
        const memoryManager = await getMemoryManager();
        const selectors = await memoryManager.getDomainSelectors(domain);

        const formattedSelectors = selectors.slice(0, limit).map((sel) => ({
          id: sel.id,
          elementName: sel.element_name,
          elementType: sel.element_type,
          primarySelector: sel.primary_selector,
          confidence: sel.confidence,
          usageCount: sel.usage_count,
          successCount: sel.success_count,
          fallbacks: sel.fallbacks,
        }));

        return {
          success: true,
          selectors: formattedSelectors,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 2. Search Selectors
  const searchSelectorsSchema = z.object({
    domain: z.string().min(1),
    query: z.string().min(1),
  });

  app.get(
    '/selectors/search',
    {
      schema: {
        querystring: searchSelectorsSchema,
      },
    },
    async (request, reply) => {
      const { domain, query } = request.query;

      try {
        const memoryManager = await getMemoryManager();
        const results = await memoryManager.searchSelectors(domain, query);

        const formattedResults = results.map((sel) => ({
          elementName: sel.element_name,
          primarySelector: sel.primary_selector,
        }));

        return {
          success: true,
          results: formattedResults,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 3. Query Vector Memory
  const queryVectorSchema = z.object({
    domain: z.string().min(1),
    query: z.string().min(1),
    limit: z.number().optional().default(3),
  });

  app.post(
    '/vector/search',
    {
      schema: {
        body: queryVectorSchema,
      },
    },
    async (request, reply) => {
      const { domain, query, limit } = request.body;

      try {
        const memoryManager = await getMemoryManager();
        const results = await memoryManager.searchVectorContext(
          domain,
          query,
          limit,
        );

        const formattedResults = results.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          domain: r.domain,
          taskSummary: r.task_summary,
          contextJson: r.context_json,
          similarity: r.similarity,
        }));

        return {
          success: true,
          results: formattedResults,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 4. Get Memory Statistics
  app.get('/stats', async (request, reply) => {
    try {
      const memoryManager = await getMemoryManager();
      const stats = await memoryManager.getStats();

      return {
        success: true,
        database: {
          host: stats.database.host,
          database: stats.database.database,
          tables: stats.database.tables,
        },
        memory: {
          total: stats.memory.total,
          averageConfidence: stats.memory.averageConfidence,
          byType: stats.memory.byType,
          byDomain: stats.memory.byDomain,
        },
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });

  // 5. Clear Memory
  const clearMemorySchema = z.object({
    domain: z.string().optional(),
    all: z
      .string()
      .optional()
      .transform((val) => val === 'true'),
  });

  app.delete(
    '/',
    {
      schema: {
        querystring: clearMemorySchema,
      },
    },
    async (request, reply) => {
      const { domain, all } = request.query;

      try {
        const memoryManager = await getMemoryManager();

        if (all) {
          const count = await memoryManager.clearAll();
          return {
            success: true,
            deletedCount: count,
            message: 'Memory entries cleared successfully',
          };
        } else if (domain) {
          const count = await memoryManager.clearDomain(domain);
          return {
            success: true,
            deletedCount: count,
            message: `Memory entries for ${domain} cleared successfully`,
          };
        } else {
          return reply.status(400).send({
            success: false,
            error: 'Specify domain query parameter or all=true',
          });
        }
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );
}
