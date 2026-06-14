import { FastifyInstance } from 'fastify';

export async function memoryRoutes(app: FastifyInstance) {
  app.get('/selectors', async () => {
    return { success: true, message: 'memory selectors skeleton' };
  });
}
