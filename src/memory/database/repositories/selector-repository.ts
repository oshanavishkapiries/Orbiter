import { BaseRepository } from './base-repository.js';
import { MemoryRepository } from './memory-repository.js';

export interface SelectorRow {
  id: string;
  memory_id: string;
  domain: string;
  element_name: string;
  element_type: string;
  primary_selector: string;
  page_url_pattern: string | null;
  description: string | null;
  created_at: number;
  updated_at: number;
}

export interface SelectorFallbackRow {
  id: number;
  selector_id: string;
  fallback_selector: string;
  priority: number;
  success_count: number;
  failure_count: number;
}

export interface SelectorWithFallbacks extends SelectorRow {
  fallbacks: string[];
  confidence: number;
  usage_count: number;
  success_count: number;
}

export interface CreateSelectorInput {
  domain: string;
  elementName: string;
  elementType: string;
  primarySelector: string;
  fallbacks?: string[];
  pageUrlPattern?: string;
  description?: string;
  learnedFrom?: string;
}

export class SelectorRepository extends BaseRepository<SelectorRow> {
  private memoryRepo: MemoryRepository;

  constructor() {
    super();
    this.memoryRepo = new MemoryRepository();
  }

  async create(input: CreateSelectorInput): Promise<SelectorWithFallbacks> {
    const now = this.now();

    const memory = await this.memoryRepo.create({
      type: 'selector',
      domain: input.domain,
      key: `${input.elementType}:${input.elementName}`,
      confidence: 0.7,
      learnedFrom: input.learnedFrom,
    });

    const selectorId = this.generateId('sel');

    await this.pool.query(
      `INSERT INTO selectors (
        id, memory_id, domain, element_name, element_type,
        primary_selector, page_url_pattern, description,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        selectorId,
        memory.id,
        input.domain,
        input.elementName,
        input.elementType,
        input.primarySelector,
        input.pageUrlPattern || null,
        input.description || null,
        now,
        now,
      ],
    );

    if (input.fallbacks && input.fallbacks.length > 0) {
      for (let i = 0; i < input.fallbacks.length; i++) {
        await this.pool.query(
          'INSERT INTO selector_fallbacks (selector_id, fallback_selector, priority) VALUES ($1, $2, $3)',
          [selectorId, input.fallbacks[i], i],
        );
      }
    }

    return (await this.findById(selectorId))!;
  }

  async findById(id: string): Promise<SelectorWithFallbacks | null> {
    const result = await this.pool.query(
      'SELECT * FROM selectors WHERE id = $1',
      [id],
    );
    const selector = result.rows[0] as SelectorRow | undefined;
    if (!selector) return null;
    return this.enrichWithFallbacks(selector);
  }

  async findByElement(
    domain: string,
    elementName: string,
  ): Promise<SelectorWithFallbacks | null> {
    const result = await this.pool.query(
      `SELECT s.* FROM selectors s
       JOIN memories m ON s.memory_id = m.id
       WHERE s.domain = $1 AND s.element_name = $2 AND m.is_active = 1
       ORDER BY m.confidence DESC
       LIMIT 1`,
      [domain, elementName],
    );
    const selector = result.rows[0] as SelectorRow | undefined;
    if (!selector) return null;
    return this.enrichWithFallbacks(selector);
  }

  async findByType(
    domain: string,
    elementType: string,
  ): Promise<SelectorWithFallbacks[]> {
    const result = await this.pool.query(
      `SELECT s.* FROM selectors s
       JOIN memories m ON s.memory_id = m.id
       WHERE s.domain = $1 AND s.element_type = $2 AND m.is_active = 1
       ORDER BY m.confidence DESC`,
      [domain, elementType],
    );
    return Promise.all(
      (result.rows as SelectorRow[]).map((s) => this.enrichWithFallbacks(s)),
    );
  }

  async findByDomain(domain: string): Promise<SelectorWithFallbacks[]> {
    const result = await this.pool.query(
      `SELECT s.* FROM selectors s
       JOIN memories m ON s.memory_id = m.id
       WHERE s.domain = $1 AND m.is_active = 1
       ORDER BY m.confidence DESC`,
      [domain],
    );
    return Promise.all(
      (result.rows as SelectorRow[]).map((s) => this.enrichWithFallbacks(s)),
    );
  }

  async search(
    domain: string,
    namePattern: string,
  ): Promise<SelectorWithFallbacks[]> {
    const result = await this.pool.query(
      `SELECT s.* FROM selectors s
       JOIN memories m ON s.memory_id = m.id
       WHERE s.domain = $1 AND s.element_name LIKE $2 AND m.is_active = 1
       ORDER BY m.confidence DESC
       LIMIT 10`,
      [domain, `%${namePattern}%`],
    );
    return Promise.all(
      (result.rows as SelectorRow[]).map((s) => this.enrichWithFallbacks(s)),
    );
  }

  async updatePrimarySelector(id: string, newSelector: string): Promise<void> {
    await this.pool.query(
      'UPDATE selectors SET primary_selector = $1, updated_at = $2 WHERE id = $3',
      [newSelector, this.now(), id],
    );
  }

  async addFallback(
    selectorId: string,
    fallbackSelector: string,
  ): Promise<void> {
    const maxResult = await this.pool.query(
      'SELECT MAX(priority) as max FROM selector_fallbacks WHERE selector_id = $1',
      [selectorId],
    );
    const maxPriority = maxResult.rows[0]?.max || 0;

    await this.pool.query(
      'INSERT INTO selector_fallbacks (selector_id, fallback_selector, priority) VALUES ($1, $2, $3)',
      [selectorId, fallbackSelector, maxPriority + 1],
    );
  }

  async recordSuccess(selectorId: string): Promise<void> {
    const result = await this.pool.query(
      'SELECT memory_id FROM selectors WHERE id = $1',
      [selectorId],
    );
    if (result.rows[0]) {
      await this.memoryRepo.recordSuccess(result.rows[0].memory_id);
    }
  }

  async recordFailure(selectorId: string): Promise<void> {
    const result = await this.pool.query(
      'SELECT memory_id FROM selectors WHERE id = $1',
      [selectorId],
    );
    if (result.rows[0]) {
      await this.memoryRepo.recordFailure(result.rows[0].memory_id);
    }
  }

  async recordFallbackSuccess(
    selectorId: string,
    fallbackSelector: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE selector_fallbacks
       SET success_count = success_count + 1
       WHERE selector_id = $1 AND fallback_selector = $2`,
      [selectorId, fallbackSelector],
    );
  }

  private async enrichWithFallbacks(
    selector: SelectorRow,
  ): Promise<SelectorWithFallbacks> {
    const fallbackResult = await this.pool.query(
      `SELECT * FROM selector_fallbacks
       WHERE selector_id = $1
       ORDER BY priority`,
      [selector.id],
    );

    const memory = await this.memoryRepo.findById(selector.memory_id);

    return {
      ...selector,
      fallbacks: (fallbackResult.rows as SelectorFallbackRow[]).map(
        (f) => f.fallback_selector,
      ),
      confidence: memory?.confidence || 0,
      usage_count: memory?.usage_count || 0,
      success_count: memory?.success_count || 0,
    };
  }
}
