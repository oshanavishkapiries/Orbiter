import { DatabaseConnection } from '../connection.js';

export interface CreateVectorMemoryInput {
  id: string;
  sessionId?: string;
  domain: string;
  taskSummary: string;
  contextJson: any;
  embedding: number[];
}

export class VectorRepository {
  async create(input: CreateVectorMemoryInput): Promise<void> {
    const client = await DatabaseConnection.getInstance().getPool().connect();
    try {
      const embeddingStr = `[${input.embedding.join(',')}]`;
      const query = `
        INSERT INTO orbiter_vector_memories (
          id, session_id, domain, task_summary, context_json, embedding, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      const values = [
        input.id,
        input.sessionId || null,
        input.domain,
        input.taskSummary,
        JSON.stringify(input.contextJson),
        embeddingStr,
        Date.now(),
      ];
      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  async search(domain: string, embedding: number[], limit = 3): Promise<any[]> {
    const client = await DatabaseConnection.getInstance().getPool().connect();
    try {
      const embeddingStr = `[${embedding.join(',')}]`;
      // <=> is cosine distance in pgvector. 1 - distance = similarity.
      const query = `
        SELECT 
          id, session_id, domain, task_summary, context_json,
          1 - (embedding <=> $1::vector) as similarity
        FROM orbiter_vector_memories
        WHERE domain = $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      `;
      const result = await client.query(query, [embeddingStr, domain, limit]);
      return result.rows;
    } finally {
      client.release();
    }
  }
}
