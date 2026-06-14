import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import crypto from 'crypto';
import { DatabaseConnection } from '../../memory/database/connection.js';
import { signJwt, getOrGenerateKeys } from '../jwt.js';

export async function authRoutes(
  app: FastifyInstance<any, any, any, any, ZodTypeProvider>,
) {
  const loginSchema = z.object({
    username: z.string(),
    password: z.string(),
  });

  app.post(
    '/login',
    {
      schema: {
        body: loginSchema,
      },
    },
    async (request, reply) => {
      const { username, password } = request.body;

      try {
        const pool = DatabaseConnection.getInstance().getPool();
        const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

        if (res.rows.length === 0 || res.rows[0].password !== password) {
          return reply.status(401).send({
            success: false,
            error: 'Invalid username or password',
          });
        }

        const user = res.rows[0];
        const token = await signJwt({
          id: user.id,
          username: user.username,
          exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
        });

        return {
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
          },
        };
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: (err as Error).message,
        });
      }
    }
  );

  // JWKS endpoint to expose the public key
  app.get('/jwks', async (request, reply) => {
    try {
      const { publicKeyPem, kid } = await getOrGenerateKeys();
      const keyObj = crypto.createPublicKey(publicKeyPem);
      const jwk = keyObj.export({ format: 'jwk' });

      return {
        keys: [
          {
            ...jwk,
            alg: 'RS256',
            use: 'sig',
            kid,
          },
        ],
      };
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: (err as Error).message,
      });
    }
  });
}
