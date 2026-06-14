import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config, getUserConfig } from '../../config/index.js';
import { ProfileManager } from '../../browser/profile-manager.js';
import { LLMFactory } from '../../llm/factory.js';
import { DataRepository } from '../../memory/database/repositories/data-repository.js';
import { DatabaseConnection } from '../../memory/database/connection.js';

export async function systemRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  const profileManager = new ProfileManager();

  // 1. Get current configuration
  app.get('/config', async (request, reply) => {
    const userId = (request as any).user?.id;
    const cfg = userId ? await getUserConfig(userId) : config();
    return {
      success: true,
      config: cfg,
    };
  });

  // 2. Get user specific settings list
  app.get('/settings', async (request, reply) => {
    const userId = (request as any).user?.id;
    if (!userId) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
      });
    }

    try {
      const repo = new DataRepository();
      const settings = await repo.getUserSettings(userId);
      return {
        success: true,
        settings,
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: `Failed to fetch settings: ${(err as Error).message}`,
      });
    }
  });

  // 3. Update settings in database
  const updateSettingsSchema = z.object({
    settings: z.array(
      z.object({
        key: z.string(),
        value: z.string(),
      }),
    ),
  });

  app.put(
    '/settings',
    {
      schema: {
        body: updateSettingsSchema,
      },
    },
    async (request, reply) => {
      const { settings } = request.body;
      const userId = (request as any).user?.id;

      if (!userId) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
        });
      }

      try {
        const repo = new DataRepository();
        await repo.updateUserSettings(userId, settings);
        return {
          success: true,
          message: 'Settings updated successfully',
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: `Failed to update settings: ${(err as Error).message}`,
        });
      }
    },
  );

  // 3. List browser profiles
  app.get('/profiles', async () => {
    try {
      const rawProfiles = profileManager.listProfiles();
      const profiles = rawProfiles.map((p) => ({
        name: p.name,
        path: p.path,
        hasSavedState: profileManager.hasSavedState(p.path),
        createdAt: p.createdAt || 0,
        lastUsedAt: p.lastUsedAt || null,
        description: p.description || '',
      }));

      return {
        success: true,
        profiles,
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  });

  // 4. Create browser profile
  const createProfileSchema = z.object({
    name: z
      .string()
      .min(1)
      .regex(/^[a-zA-Z0-9_-]+$/, 'Alphanumeric, underscores and hyphens only'),
    description: z.string().optional(),
  });

  app.post(
    '/profiles',
    {
      schema: {
        body: createProfileSchema,
      },
    },
    async (request, reply) => {
      const { name, description } = request.body;

      try {
        const profile = profileManager.createProfile(name, description);
        return reply.status(201).send({
          success: true,
          profile: {
            name: profile.name,
            path: profile.path,
          },
        });
      } catch (err) {
        return reply.status(400).send({
          success: false,
          error: (err as Error).message,
        });
      }
    },
  );

  // 5. Get profile details
  const getProfileSchema = z.object({
    name: z.string(),
  });

  app.get(
    '/profiles/:name',
    {
      schema: {
        params: getProfileSchema,
      },
    },
    async (request, reply) => {
      const { name } = request.params;

      try {
        const rawProfiles = profileManager.listProfiles();
        const p = rawProfiles.find((profile) => profile.name === name);

        if (!p) {
          return reply.status(404).send({
            success: false,
            error: `Profile "${name}" not found`,
          });
        }

        return {
          success: true,
          profile: {
            name: p.name,
            path: p.path,
            hasSavedState: profileManager.hasSavedState(p.path),
            createdAt: p.createdAt || 0,
            lastUsedAt: p.lastUsedAt || null,
            description: p.description || '',
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

  // 6. List available LLM models
  const getModelsSchema = z.object({
    provider: z.string().optional(),
  });

  app.get(
    '/models',
    {
      schema: {
        querystring: getModelsSchema,
      },
    },
    async (request, reply) => {
      const { provider } = request.query;
      const userId = (request as any).user?.id;

      try {
        const cfg = userId ? await getUserConfig(userId) : config();
        const llmProvider = LLMFactory.create(provider, undefined, cfg);
        const models = await (llmProvider as any).getModels();

        const formattedModels = models.map((m: any) => ({
          id: m.id || m.name || m.model || 'unknown',
          name: m.name || m.id || 'unknown',
          contextLength: m.context_length || null,
        }));

        return {
          success: true,
          provider: llmProvider.name,
          models: formattedModels,
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: `Failed to fetch models: ${(err as Error).message}`,
        });
      }
    },
  );
}
