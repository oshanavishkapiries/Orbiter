import fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { authRoutes } from './routes/auth.js';
import { systemRoutes } from './routes/system.js';
import { memoryRoutes } from './routes/memory.js';
import { flowsRoutes } from './routes/flows.js';
import { executionRoutes } from './routes/execution.js';
import { verifyJwt } from './jwt.js';

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

  // Health check route (unprotected)
  app.get('/health', async () => {
    return { status: 'OK', timestamp: Date.now() };
  });

  // Register public authentication endpoints
  app.register(authRoutes, { prefix: '/api/v1/auth' });

  // Global authentication hook for all other endpoints under /api/v1/*
  app.addHook('onRequest', async (request, reply) => {
    const url = request.url.split('?')[0];
    
    // Bypass auth for health check, login, and jwks
    if (url === '/health' || url === '/api/v1/auth/login' || url === '/api/v1/auth/jwks') {
      return;
    }

    // Extract Bearer token from header or SSE query parameter token
    let token = '';
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (request.query && (request.query as any).token) {
      token = (request.query as any).token;
    }

    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized: Missing session token',
      });
    }

    const decoded = await verifyJwt(token);
    if (!decoded) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized: Invalid or expired session token',
      });
    }

    // Attach decoded user info to request
    (request as any).user = decoded;
  });

  // Register protected domains
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
