import fastify from 'fastify';
import cors from '@fastify/cors';
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { systemRoutes } from './routes/system.js';
import { memoryRoutes } from './routes/memory.js';
import { flowsRoutes } from './routes/flows.js';
import { executionRoutes } from './routes/execution.js';

export function createServer() {
  const app = fastify({
    logger: true,
  }).withTypeProvider<ZodTypeProvider>();

  // Setup Zod compilers
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Enable CORS
  app.register(cors, {
    origin: '*',
  });

  // Health check route
  app.get('/health', async () => {
    return { status: 'OK', timestamp: Date.now() };
  });

  // Register domains
  app.register(systemRoutes, { prefix: '/api/v1/system' });
  app.register(memoryRoutes, { prefix: '/api/v1/memory' });
  app.register(flowsRoutes, { prefix: '/api/v1/flows' });
  app.register(executionRoutes, { prefix: '/api/v1/execution' });

  // Global error handler
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(error);
    
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Validation Error',
        details: error.validation,
      });
    }

    return reply.status(500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  return app;
}
