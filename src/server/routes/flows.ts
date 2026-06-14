import { FastifyInstance } from 'fastify';

export async function flowsRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return { success: true, message: 'flows list skeleton' };
  });
}
