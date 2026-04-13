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

  /**
   * Create error pattern
   */
  create(input: CreateErrorPatternInput): ErrorPatternWithConfidence {
    const now = this.now();

    // Create memory entry
    const memoryKey = `${input.errorType}:${input.failedSelector || input.failedTool || 'unknown'}`;
    const memory = this.memoryRepo.create({
      type: 'error_pattern',
      domain: input.domain,
      key: memoryKey,
      confidence: 0.8,
      learnedFrom: 'recovery',
    });

    // Create error pattern
    const id = this.generateId('err');

    const stmt = this.db.prepare(`
      INSERT INTO error_patterns (
        id, memory_id, domain, error_type, failed_selector, failed_tool,
        working_selector, recovery_strategy, context, page_url_pattern, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
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
    );

    return this.findById(id)!;
  }

  /**
   * Find by ID
   */
  findById(id: string): ErrorPatternWithConfidence | null {
    const pattern = this.db
      .prepare('SELECT * FROM error_patterns WHERE id = ?')
      .get(id) as ErrorPatternRow | null;

    if (!pattern) return null;

    return this.enrichWithMemory(pattern);
  }

  /**
   * Find matching error pattern
   */
  findMatch(
    domain: string,
    errorType: string,
    failedSelector?: string,
  ): ErrorPatternWithConfidence | null {
    // Try exact match first
    if (failedSelector) {
      const exact = this.db
        .prepare(
          `
          SELECT ep.* FROM error_patterns ep
          JOIN memories m ON ep.memory_id = m.id
          WHERE ep.domain = ? AND ep.error_type = ? AND ep.failed_selector = ?
            AND m.is_active = 1
          ORDER BY m.confidence DESC
          LIMIT 1
        `,
        )
        .get(domain, errorType, failedSelector) as ErrorPatternRow | null;

      if (exact) return this.enrichWithMemory(exact);
    }

    // Try error type match
    const typeMatch = this.db
      .prepare(
        `
        SELECT ep.* FROM error_patterns ep
        JOIN memories m ON ep.memory_id = m.id
        WHERE ep.domain = ? AND ep.error_type = ? AND m.is_active = 1
        ORDER BY m.confidence DESC
        LIMIT 1
      `,
      )
      .get(domain, errorType) as ErrorPatternRow | null;

    if (typeMatch) return this.enrichWithMemory(typeMatch);

    return null;
  }

  /**
   * Find all patterns for domain
   */
  findByDomain(domain: string): ErrorPatternWithConfidence[] {
    const patterns = this.db
      .prepare(
        `
        SELECT ep.* FROM error_patterns ep
        JOIN memories m ON ep.memory_id = m.id
        WHERE ep.domain = ? AND m.is_active = 1
        ORDER BY m.confidence DESC
      `,
      )
      .all(domain) as ErrorPatternRow[];

    return patterns.map((p) => this.enrichWithMemory(p));
  }

  /**
   * Record usage success
   */
  recordSuccess(id: string): void {
    const pattern = this.db
      .prepare('SELECT memory_id FROM error_patterns WHERE id = ?')
      .get(id) as { memory_id: string } | null;

    if (pattern) {
      this.memoryRepo.recordSuccess(pattern.memory_id);
    }
  }

  /**
   * Enrich with memory data
   */
  private enrichWithMemory(
    pattern: ErrorPatternRow,
  ): ErrorPatternWithConfidence {
    const memory = this.memoryRepo.findById(pattern.memory_id);

    return {
      ...pattern,
      confidence: memory?.confidence || 0,
      usage_count: memory?.usage_count || 0,
      success_count: memory?.success_count || 0,
    };
  }
}
