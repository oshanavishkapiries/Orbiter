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

  /**
   * Create selector with fallbacks
   */
  create(input: CreateSelectorInput): SelectorWithFallbacks {
    const now = this.now();

    // Create memory entry first
    const memory = this.memoryRepo.create({
      type: 'selector',
      domain: input.domain,
      key: `${input.elementType}:${input.elementName}`,
      confidence: 0.7,
      learnedFrom: input.learnedFrom,
    });

    // Create selector entry
    const selectorId = this.generateId('sel');

    const selectorStmt = this.db.prepare(`
      INSERT INTO selectors (
        id, memory_id, domain, element_name, element_type,
        primary_selector, page_url_pattern, description,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    selectorStmt.run(
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
    );

    // Add fallbacks
    if (input.fallbacks && input.fallbacks.length > 0) {
      const fallbackStmt = this.db.prepare(`
        INSERT INTO selector_fallbacks (selector_id, fallback_selector, priority)
        VALUES (?, ?, ?)
      `);

      input.fallbacks.forEach((fallback, index) => {
        fallbackStmt.run(selectorId, fallback, index);
      });
    }

    return this.findById(selectorId)!;
  }

  /**
   * Find selector by ID with fallbacks
   */
  findById(id: string): SelectorWithFallbacks | null {
    const selector = this.db
      .prepare('SELECT * FROM selectors WHERE id = ?')
      .get(id) as SelectorRow | null;

    if (!selector) return null;

    return this.enrichWithFallbacks(selector);
  }

  /**
   * Find selector by domain and element name
   */
  findByElement(
    domain: string,
    elementName: string,
  ): SelectorWithFallbacks | null {
    const selector = this.db
      .prepare(
        `
        SELECT s.* FROM selectors s
        JOIN memories m ON s.memory_id = m.id
        WHERE s.domain = ? AND s.element_name = ? AND m.is_active = 1
        ORDER BY m.confidence DESC
        LIMIT 1
      `,
      )
      .get(domain, elementName) as SelectorRow | null;

    if (!selector) return null;

    return this.enrichWithFallbacks(selector);
  }

  /**
   * Find selectors by domain and element type
   */
  findByType(domain: string, elementType: string): SelectorWithFallbacks[] {
    const selectors = this.db
      .prepare(
        `
        SELECT s.* FROM selectors s
        JOIN memories m ON s.memory_id = m.id
        WHERE s.domain = ? AND s.element_type = ? AND m.is_active = 1
        ORDER BY m.confidence DESC
      `,
      )
      .all(domain, elementType) as SelectorRow[];

    return selectors.map((s) => this.enrichWithFallbacks(s));
  }

  /**
   * Find all selectors for domain
   */
  findByDomain(domain: string): SelectorWithFallbacks[] {
    const selectors = this.db
      .prepare(
        `
        SELECT s.* FROM selectors s
        JOIN memories m ON s.memory_id = m.id
        WHERE s.domain = ? AND m.is_active = 1
        ORDER BY m.confidence DESC
      `,
      )
      .all(domain) as SelectorRow[];

    return selectors.map((s) => this.enrichWithFallbacks(s));
  }

  /**
   * Search selectors by name pattern
   */
  search(domain: string, namePattern: string): SelectorWithFallbacks[] {
    const selectors = this.db
      .prepare(
        `
        SELECT s.* FROM selectors s
        JOIN memories m ON s.memory_id = m.id
        WHERE s.domain = ? AND s.element_name LIKE ? AND m.is_active = 1
        ORDER BY m.confidence DESC
        LIMIT 10
      `,
      )
      .all(domain, `%${namePattern}%`) as SelectorRow[];

    return selectors.map((s) => this.enrichWithFallbacks(s));
  }

  /**
   * Update primary selector
   */
  updatePrimarySelector(id: string, newSelector: string): void {
    const stmt = this.db.prepare(`
      UPDATE selectors SET primary_selector = ?, updated_at = ? WHERE id = ?
    `);
    stmt.run(newSelector, this.now(), id);
  }

  /**
   * Add fallback selector
   */
  addFallback(selectorId: string, fallbackSelector: string): void {
    // Get max priority
    const maxPriority =
      (
        this.db
          .prepare(
            'SELECT MAX(priority) as max FROM selector_fallbacks WHERE selector_id = ?',
          )
          .get(selectorId) as any
      ).max || 0;

    const stmt = this.db.prepare(`
      INSERT INTO selector_fallbacks (selector_id, fallback_selector, priority)
      VALUES (?, ?, ?)
    `);
    stmt.run(selectorId, fallbackSelector, maxPriority + 1);
  }

  /**
   * Record selector success (also updates memory)
   */
  recordSuccess(selectorId: string): void {
    const selector = this.db
      .prepare('SELECT memory_id FROM selectors WHERE id = ?')
      .get(selectorId) as { memory_id: string } | null;

    if (selector) {
      this.memoryRepo.recordSuccess(selector.memory_id);
    }
  }

  /**
   * Record selector failure
   */
  recordFailure(selectorId: string): void {
    const selector = this.db
      .prepare('SELECT memory_id FROM selectors WHERE id = ?')
      .get(selectorId) as { memory_id: string } | null;

    if (selector) {
      this.memoryRepo.recordFailure(selector.memory_id);
    }
  }

  /**
   * Record fallback success
   */
  recordFallbackSuccess(selectorId: string, fallbackSelector: string): void {
    const stmt = this.db.prepare(`
      UPDATE selector_fallbacks 
      SET success_count = success_count + 1 
      WHERE selector_id = ? AND fallback_selector = ?
    `);
    stmt.run(selectorId, fallbackSelector);
  }

  /**
   * Enrich selector with fallbacks and memory data
   */
  private enrichWithFallbacks(selector: SelectorRow): SelectorWithFallbacks {
    const fallbackRows = this.db
      .prepare(
        `
        SELECT * FROM selector_fallbacks 
        WHERE selector_id = ? 
        ORDER BY priority
      `,
      )
      .all(selector.id) as SelectorFallbackRow[];

    const memory = this.memoryRepo.findById(selector.memory_id);

    return {
      ...selector,
      fallbacks: fallbackRows.map((f) => f.fallback_selector),
      confidence: memory?.confidence || 0,
      usage_count: memory?.usage_count || 0,
      success_count: memory?.success_count || 0,
    };
  }
}
