import { logger } from '../cli/ui/logger.js';
import { DatabaseConnection } from './database/connection.js';
import { MemoryRepository } from './database/repositories/memory-repository.js';
import {
  SelectorRepository,
  SelectorWithFallbacks,
  CreateSelectorInput,
} from './database/repositories/selector-repository.js';
import {
  ErrorPatternRepository,
  ErrorPatternWithConfidence,
  CreateErrorPatternInput,
} from './database/repositories/error-pattern-repository.js';

export class MemoryManager {
  private memoryRepo: MemoryRepository;
  private selectorRepo: SelectorRepository;
  private errorPatternRepo: ErrorPatternRepository;

  constructor() {
    // Ensure database is initialized
    DatabaseConnection.getInstance();

    this.memoryRepo = new MemoryRepository();
    this.selectorRepo = new SelectorRepository();
    this.errorPatternRepo = new ErrorPatternRepository();
  }

  // ─────────────────────────────────────────────
  // Selector Memory
  // ─────────────────────────────────────────────

  /**
   * Remember a working selector
   */
  rememberSelector(input: CreateSelectorInput): SelectorWithFallbacks {
    logger.debug(
      `Remembering selector: ${input.elementName} on ${input.domain}`,
    );
    return this.selectorRepo.create(input);
  }

  /**
   * Get selector for element
   */
  getSelector(
    domain: string,
    elementName: string,
  ): SelectorWithFallbacks | null {
    return this.selectorRepo.findByElement(domain, elementName);
  }

  /**
   * Get all selectors for domain
   */
  getDomainSelectors(domain: string): SelectorWithFallbacks[] {
    return this.selectorRepo.findByDomain(domain);
  }

  /**
   * Search selectors
   */
  searchSelectors(
    domain: string,
    namePattern: string,
  ): SelectorWithFallbacks[] {
    return this.selectorRepo.search(domain, namePattern);
  }

  /**
   * Record selector success
   */
  recordSelectorSuccess(selectorId: string): void {
    this.selectorRepo.recordSuccess(selectorId);
  }

  /**
   * Record selector failure
   */
  recordSelectorFailure(selectorId: string): void {
    this.selectorRepo.recordFailure(selectorId);
  }

  /**
   * Add fallback to existing selector
   */
  addSelectorFallback(selectorId: string, fallback: string): void {
    this.selectorRepo.addFallback(selectorId, fallback);
  }

  // ─────────────────────────────────────────────
  // Error Pattern Memory
  // ─────────────────────────────────────────────

  /**
   * Remember error recovery
   */
  rememberErrorRecovery(
    input: CreateErrorPatternInput,
  ): ErrorPatternWithConfidence {
    logger.debug(
      `Remembering error recovery: ${input.errorType} on ${input.domain}`,
    );
    return this.errorPatternRepo.create(input);
  }

  /**
   * Get error recovery suggestion
   */
  getErrorRecovery(
    domain: string,
    errorType: string,
    failedSelector?: string,
  ): ErrorPatternWithConfidence | null {
    return this.errorPatternRepo.findMatch(domain, errorType, failedSelector);
  }

  /**
   * Record error recovery success
   */
  recordRecoverySuccess(patternId: string): void {
    this.errorPatternRepo.recordSuccess(patternId);
  }

  // ─────────────────────────────────────────────
  // General
  // ─────────────────────────────────────────────

  /**
   * Get statistics
   */
  getStats() {
    const dbConn = DatabaseConnection.getInstance();
    const dbStats = dbConn.getStats();
    const memoryStats = this.memoryRepo.getStats();

    return {
      database: dbStats,
      memory: memoryStats,
    };
  }

  /**
   * Clear domain
   */
  clearDomain(domain: string): number {
    return this.memoryRepo.deleteByDomain(domain);
  }

  /**
   * Clear all
   */
  clearAll(): number {
    return this.memoryRepo.deleteAll();
  }

  /**
   * Backup database
   */
  async backup(path?: string): Promise<string> {
    const dbConn = DatabaseConnection.getInstance();
    return dbConn.backup(path);
  }

  /**
   * Extract domain from URL
   */
  static extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return 'unknown';
    }
  }
}

// Singleton
let managerInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!managerInstance) {
    managerInstance = new MemoryManager();
  }
  return managerInstance;
}
