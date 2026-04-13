import { BaseRepository } from './base-repository.js';
import { MemoryRepository } from './memory-repository.js';

export interface ErrorPatternRow {
  id: string;
  memory_id: string;
  domain: string;
  error_type: string;
  failed_selector: string | null;
  failed_tool: string | null;
  working_selector: string | null;
  recovery_strategy: string;
  context: string | null;
  page_url_pattern: string | null;
  created_at: number;
}

export interface ErrorPatternWithConfidence extends ErrorPatternRow {
  confidence: number;
  usage_count: number;
  success_count: number;
}

export interface CreateErrorPatternInput {
  domain: string;
  errorType: string;
  failedSelector?: string;
  failedTool?: string;
  workingSelector?: string;
  recoveryStrategy: string;
  context?: string;
  pageUrlPattern?: string;
}

export class ErrorPatternRepository extends BaseRepository<ErrorPatternRow> {
  private memoryRepo: MemoryRepository;

  constructor() {
    super();
    this.memoryRepo = new MemoryRepository();
  }

  async create(
    input: CreateErrorPatternInput,
  ): Promise<ErrorPatternWithConfidence> {
    const now = this.now();

    const memoryKey = `${input.errorType}:${input.failedSelector || input.failedTool || 'unknown'}`;
    const memory = await this.memoryRepo.create({
      type: 'error_pattern',
      domain: input.domain,
      key: memoryKey,
      confidence: 0.8,
      learnedFrom: 'recovery',
    });

    const id = this.generateId('err');

    await this.pool.query(
      `INSERT INTO error_patterns (
        id, memory_id, domain, error_type, failed_selector, failed_tool,
        working_selector, recovery_strategy, context, page_url_pattern, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        memory.id,
        input.domain,
        input.errorType,
        input.failedSelector || null,
        input.failedTool || null,
        input.workingSelector || null,
        input.recoveryStrategy,
        input.context || null,
        input.pageUrlPattern || null,
        now,
      ],
    );

    return (await this.findById(id))!;
  }

  async findById(id: string): Promise<ErrorPatternWithConfidence | null> {
    const result = await this.pool.query(
      'SELECT * FROM error_patterns WHERE id = $1',
      [id],
    );
    const pattern = result.rows[0] as ErrorPatternRow | undefined;
    if (!pattern) return null;
    return this.enrichWithMemory(pattern);
  }

  async findMatch(
    domain: string,
    errorType: string,
    failedSelector?: string,
  ): Promise<ErrorPatternWithConfidence | null> {
    if (failedSelector) {
      const exact = await this.pool.query(
        `SELECT ep.* FROM error_patterns ep
         JOIN memories m ON ep.memory_id = m.id
         WHERE ep.domain = $1 AND ep.error_type = $2 AND ep.failed_selector = $3
           AND m.is_active = 1
         ORDER BY m.confidence DESC
         LIMIT 1`,
        [domain, errorType, failedSelector],
      );
      if (exact.rows[0]) {
        return this.enrichWithMemory(exact.rows[0] as ErrorPatternRow);
      }
    }

    const typeMatch = await this.pool.query(
      `SELECT ep.* FROM error_patterns ep
       JOIN memories m ON ep.memory_id = m.id
       WHERE ep.domain = $1 AND ep.error_type = $2 AND m.is_active = 1
       ORDER BY m.confidence DESC
       LIMIT 1`,
      [domain, errorType],
    );
    if (typeMatch.rows[0]) {
      return this.enrichWithMemory(typeMatch.rows[0] as ErrorPatternRow);
    }

    return null;
  }

  async findByDomain(domain: string): Promise<ErrorPatternWithConfidence[]> {
    const result = await this.pool.query(
      `SELECT ep.* FROM error_patterns ep
       JOIN memories m ON ep.memory_id = m.id
       WHERE ep.domain = $1 AND m.is_active = 1
       ORDER BY m.confidence DESC`,
      [domain],
    );
    return Promise.all(
      (result.rows as ErrorPatternRow[]).map((p) => this.enrichWithMemory(p)),
    );
  }

  async recordSuccess(id: string): Promise<void> {
    const result = await this.pool.query(
      'SELECT memory_id FROM error_patterns WHERE id = $1',
      [id],
    );
    if (result.rows[0]) {
      await this.memoryRepo.recordSuccess(result.rows[0].memory_id);
    }
  }

  private async enrichWithMemory(
    pattern: ErrorPatternRow,
  ): Promise<ErrorPatternWithConfidence> {
    const memory = await this.memoryRepo.findById(pattern.memory_id);

    return {
      ...pattern,
      confidence: memory?.confidence || 0,
      usage_count: memory?.usage_count || 0,
      success_count: memory?.success_count || 0,
    };
  }
}
