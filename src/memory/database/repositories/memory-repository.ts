import { BaseRepository } from './base-repository.js';

export interface MemoryRow {
  id: string;
  type: string;
  domain: string;
  url_pattern: string | null;
  key: string;
  confidence: number;
  usage_count: number;
  success_count: number;
  failure_count: number;
  learned_from: string;
  created_at: number;
  updated_at: number;
  last_used_at: number | null;
  last_success_at: number | null;
  expires_at: number | null;
  is_active: number;
}

export interface CreateMemoryInput {
  type: string;
  domain: string;
  urlPattern?: string;
  key: string;
  confidence?: number;
  learnedFrom?: string;
}

export class MemoryRepository extends BaseRepository<MemoryRow> {
  async create(input: CreateMemoryInput): Promise<MemoryRow> {
    const id = this.generateId('mem');
    const now = this.now();

    await this.pool.query(
      `INSERT INTO memories (
        id, type, domain, url_pattern, key, confidence,
        usage_count, success_count, failure_count, learned_from,
        created_at, updated_at, is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        0, 0, 0, $7,
        $8, $9, 1
      )`,
      [
        id,
        input.type,
        input.domain,
        input.urlPattern || null,
        input.key,
        input.confidence || 0.5,
        input.learnedFrom || 'execution',
        now,
        now,
      ],
    );

    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<MemoryRow | null> {
    const result = await this.pool.query(
      'SELECT * FROM memories WHERE id = $1',
      [id],
    );
    return (result.rows[0] as MemoryRow) || null;
  }

  async findByDomainAndType(
    domain: string,
    type: string,
  ): Promise<MemoryRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM memories
       WHERE domain = $1 AND type = $2 AND is_active = 1
       ORDER BY confidence DESC, last_used_at DESC`,
      [domain, type],
    );
    return result.rows as MemoryRow[];
  }

  async findByKey(
    domain: string,
    type: string,
    key: string,
  ): Promise<MemoryRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM memories
       WHERE domain = $1 AND type = $2 AND key = $3 AND is_active = 1`,
      [domain, type, key],
    );
    return (result.rows[0] as MemoryRow) || null;
  }

  async searchByKey(
    domain: string,
    keyPattern: string,
    limit: number = 10,
  ): Promise<MemoryRow[]> {
    const result = await this.pool.query(
      `SELECT * FROM memories
       WHERE domain = $1 AND key LIKE $2 AND is_active = 1
       ORDER BY confidence DESC
       LIMIT $3`,
      [domain, `%${keyPattern}%`, limit],
    );
    return result.rows as MemoryRow[];
  }

  async recordSuccess(id: string): Promise<void> {
    const now = this.now();
    await this.pool.query(
      `UPDATE memories SET
        usage_count = usage_count + 1,
        success_count = success_count + 1,
        last_used_at = $1,
        last_success_at = $2,
        updated_at = $3,
        confidence = CASE
          WHEN usage_count > 0
          THEN (success_count + 1.0) / (usage_count + 1.0) * 0.8 + 0.2
          ELSE 0.7
        END
      WHERE id = $4`,
      [now, now, now, id],
    );
  }

  async recordFailure(id: string): Promise<void> {
    const now = this.now();
    await this.pool.query(
      `UPDATE memories SET
        usage_count = usage_count + 1,
        failure_count = failure_count + 1,
        last_used_at = $1,
        updated_at = $2,
        confidence = CASE
          WHEN usage_count > 0
          THEN (success_count * 1.0) / (usage_count + 1.0) * 0.8 + 0.1
          ELSE 0.3
        END
      WHERE id = $3`,
      [now, now, id],
    );
  }

  async updateConfidence(id: string, confidence: number): Promise<void> {
    await this.pool.query(
      'UPDATE memories SET confidence = $1, updated_at = $2 WHERE id = $3',
      [confidence, this.now(), id],
    );
  }

  async deactivate(id: string): Promise<void> {
    await this.pool.query(
      'UPDATE memories SET is_active = 0, updated_at = $1 WHERE id = $2',
      [this.now(), id],
    );
  }

  async deleteByDomain(domain: string): Promise<number> {
    const result = await this.pool.query(
      'DELETE FROM memories WHERE domain = $1',
      [domain],
    );
    return result.rowCount || 0;
  }

  async deleteAll(): Promise<number> {
    const result = await this.pool.query('DELETE FROM memories');
    return result.rowCount || 0;
  }

  async getStats(): Promise<{
    total: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    averageConfidence: number;
  }> {
    const totalResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM memories WHERE is_active = 1',
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    const byType: Record<string, number> = {};
    const typeRows = await this.pool.query(
      'SELECT type, COUNT(*) as count FROM memories WHERE is_active = 1 GROUP BY type',
    );
    for (const row of typeRows.rows) {
      byType[row.type] = parseInt(row.count, 10);
    }

    const byDomain: Record<string, number> = {};
    const domainRows = await this.pool.query(
      `SELECT domain, COUNT(*) as count FROM memories
       WHERE is_active = 1 GROUP BY domain ORDER BY count DESC LIMIT 20`,
    );
    for (const row of domainRows.rows) {
      byDomain[row.domain] = parseInt(row.count, 10);
    }

    const avgResult = await this.pool.query(
      'SELECT AVG(confidence) as avg FROM memories WHERE is_active = 1',
    );
    const averageConfidence = parseFloat(avgResult.rows[0].avg) || 0;

    return { total, byType, byDomain, averageConfidence };
  }
}
