import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { config } from '../../config/index.js';
import { ProfileManager } from '../../browser/profile-manager.js';
import { LLMFactory } from '../../llm/factory.js';
import { DataRepository } from '../../memory/database/repositories/data-repository.js';
import { DatabaseConnection } from '../../memory/database/connection.js';

export async function systemRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  const profileManager = new ProfileManager();

  // 1. Get current configuration
  app.get('/config', async () => {
    return {
      success: true,
      config: config(),
    };
  });

  // 2. Update settings in database
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

      try {
        const repo = new DataRepository();
        for (const item of settings) {
          await repo.setSetting(item.key, item.value);
        }
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

      try {
        const llmProvider = LLMFactory.create(provider);
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
