import { FastifyInstance } from 'fastify';

export async function systemRoutes(app: FastifyInstance) {
  app.get('/config', async () => {
    return { success: true, message: 'system config skeleton' };
  });
}
