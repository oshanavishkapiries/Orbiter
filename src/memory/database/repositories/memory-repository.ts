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
  /**
   * Create new memory entry
   */
  create(input: CreateMemoryInput): MemoryRow {
    const id = this.generateId('mem');
    const now = this.now();

    const stmt = this.db.prepare(`
      INSERT INTO memories (
        id, type, domain, url_pattern, key, confidence,
        usage_count, success_count, failure_count, learned_from,
        created_at, updated_at, is_active
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        0, 0, 0, ?,
        ?, ?, 1
      )
    `);

    stmt.run(
      id,
      input.type,
      input.domain,
      input.urlPattern || null,
      input.key,
      input.confidence || 0.5,
      input.learnedFrom || 'execution',
      now,
      now,
    );

    return this.findById(id)!;
  }

  /**
   * Find by ID
   */
  findById(id: string): MemoryRow | null {
    const stmt = this.db.prepare('SELECT * FROM memories WHERE id = ?');
    return stmt.get(id) as MemoryRow | null;
  }

  /**
   * Find by domain and type
   */
  findByDomainAndType(domain: string, type: string): MemoryRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE domain = ? AND type = ? AND is_active = 1
      ORDER BY confidence DESC, last_used_at DESC
    `);
    return stmt.all(domain, type) as MemoryRow[];
  }

  /**
   * Find by domain, type, and key
   */
  findByKey(domain: string, type: string, key: string): MemoryRow | null {
    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE domain = ? AND type = ? AND key = ? AND is_active = 1
    `);
    return stmt.get(domain, type, key) as MemoryRow | null;
  }

  /**
   * Search by partial key
   */
  searchByKey(
    domain: string,
    keyPattern: string,
    limit: number = 10,
  ): MemoryRow[] {
    const stmt = this.db.prepare(`
      SELECT * FROM memories 
      WHERE domain = ? AND key LIKE ? AND is_active = 1
      ORDER BY confidence DESC
      LIMIT ?
    `);
    return stmt.all(domain, `%${keyPattern}%`, limit) as MemoryRow[];
  }

  /**
   * Record successful usage
   */
  recordSuccess(id: string): void {
    const now = this.now();
    const stmt = this.db.prepare(`
      UPDATE memories SET
        usage_count = usage_count + 1,
        success_count = success_count + 1,
        last_used_at = ?,
        last_success_at = ?,
        updated_at = ?,
        confidence = CASE 
          WHEN usage_count > 0 
          THEN (success_count + 1.0) / (usage_count + 1.0) * 0.8 + 0.2
          ELSE 0.7
        END
      WHERE id = ?
    `);
    stmt.run(now, now, now, id);
  }

  /**
   * Record failed usage
   */
  recordFailure(id: string): void {
    const now = this.now();
    const stmt = this.db.prepare(`
      UPDATE memories SET
        usage_count = usage_count + 1,
        failure_count = failure_count + 1,
        last_used_at = ?,
        updated_at = ?,
        confidence = CASE 
          WHEN usage_count > 0 
          THEN (success_count * 1.0) / (usage_count + 1.0) * 0.8 + 0.1
          ELSE 0.3
        END
      WHERE id = ?
    `);
    stmt.run(now, now, id);
  }

  /**
   * Update confidence
   */
  updateConfidence(id: string, confidence: number): void {
    const stmt = this.db.prepare(`
      UPDATE memories SET confidence = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(confidence, this.now(), id);
  }

  /**
   * Deactivate memory
   */
  deactivate(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE memories SET is_active = 0, updated_at = ? WHERE id = ?
    `);
    stmt.run(this.now(), id);
  }

  /**
   * Delete by domain
   */
  deleteByDomain(domain: string): number {
    const stmt = this.db.prepare('DELETE FROM memories WHERE domain = ?');
    const result = stmt.run(domain);
    return result.changes;
  }

  /**
   * Delete all
   */
  deleteAll(): number {
    const stmt = this.db.prepare('DELETE FROM memories');
    const result = stmt.run();
    return result.changes;
  }

  /**
   * Get stats
   */
  getStats(): {
    total: number;
    byType: Record<string, number>;
    byDomain: Record<string, number>;
    averageConfidence: number;
  } {
    const total = (
      this.db
        .prepare('SELECT COUNT(*) as count FROM memories WHERE is_active = 1')
        .get() as any
    ).count;

    const byType: Record<string, number> = {};
    const typeRows = this.db
      .prepare(
        'SELECT type, COUNT(*) as count FROM memories WHERE is_active = 1 GROUP BY type',
      )
      .all() as Array<{ type: string; count: number }>;
    for (const row of typeRows) {
      byType[row.type] = row.count;
    }

    const byDomain: Record<string, number> = {};
    const domainRows = this.db
      .prepare(
        `
        SELECT domain, COUNT(*) as count FROM memories 
        WHERE is_active = 1 GROUP BY domain ORDER BY count DESC LIMIT 20
      `,
      )
      .all() as Array<{ domain: string; count: number }>;
    for (const row of domainRows) {
      byDomain[row.domain] = row.count;
    }

    const avgConf =
      (
        this.db
          .prepare(
            'SELECT AVG(confidence) as avg FROM memories WHERE is_active = 1',
          )
          .get() as any
      ).avg || 0;

    return {
      total,
      byType,
      byDomain,
      averageConfidence: avgConf,
    };
  }
}
