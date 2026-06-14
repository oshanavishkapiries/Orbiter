import { FastifyInstance } from 'fastify';

export async function executionRoutes(app: FastifyInstance) {
  app.post('/run', async () => {
    return { success: true, message: 'execution run skeleton' };
  });
}
