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
    this.memoryRepo = new MemoryRepository();
    this.selectorRepo = new SelectorRepository();
    this.errorPatternRepo = new ErrorPatternRepository();
  }

  async initialize(): Promise<void> {
    await DatabaseConnection.getInstance().initialize();
  }

  // ─────────────────────────────────────────────
  // Selector Memory
  // ─────────────────────────────────────────────

  async rememberSelector(
    input: CreateSelectorInput,
  ): Promise<SelectorWithFallbacks> {
    logger.debug(
      `Remembering selector: ${input.elementName} on ${input.domain}`,
    );
    return this.selectorRepo.create(input);
  }

  async getSelector(
    domain: string,
    elementName: string,
  ): Promise<SelectorWithFallbacks | null> {
    return this.selectorRepo.findByElement(domain, elementName);
  }

  async getDomainSelectors(domain: string): Promise<SelectorWithFallbacks[]> {
    return this.selectorRepo.findByDomain(domain);
  }

  async searchSelectors(
    domain: string,
    namePattern: string,
  ): Promise<SelectorWithFallbacks[]> {
    return this.selectorRepo.search(domain, namePattern);
  }

  async recordSelectorSuccess(selectorId: string): Promise<void> {
    return this.selectorRepo.recordSuccess(selectorId);
  }

  async recordSelectorFailure(selectorId: string): Promise<void> {
    return this.selectorRepo.recordFailure(selectorId);
  }

  async addSelectorFallback(
    selectorId: string,
    fallback: string,
  ): Promise<void> {
    return this.selectorRepo.addFallback(selectorId, fallback);
  }

  // ─────────────────────────────────────────────
  // Error Pattern Memory
  // ─────────────────────────────────────────────

  async rememberErrorRecovery(
    input: CreateErrorPatternInput,
  ): Promise<ErrorPatternWithConfidence> {
    logger.debug(
      `Remembering error recovery: ${input.errorType} on ${input.domain}`,
    );
    return this.errorPatternRepo.create(input);
  }

  async getErrorRecovery(
    domain: string,
    errorType: string,
    failedSelector?: string,
  ): Promise<ErrorPatternWithConfidence | null> {
    return this.errorPatternRepo.findMatch(domain, errorType, failedSelector);
  }

  async recordRecoverySuccess(patternId: string): Promise<void> {
    return this.errorPatternRepo.recordSuccess(patternId);
  }

  // ─────────────────────────────────────────────
  // General
  // ─────────────────────────────────────────────

  async getStats() {
    const dbConn = DatabaseConnection.getInstance();
    const dbStats = await dbConn.getStats();
    const memoryStats = await this.memoryRepo.getStats();

    return {
      database: dbStats,
      memory: memoryStats,
    };
  }

  async clearDomain(domain: string): Promise<number> {
    return this.memoryRepo.deleteByDomain(domain);
  }

  async clearAll(): Promise<number> {
    return this.memoryRepo.deleteAll();
  }

  async backup(path?: string): Promise<string> {
    const dbConn = DatabaseConnection.getInstance();
    return dbConn.backup(path);
  }

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

export async function getMemoryManager(): Promise<MemoryManager> {
  if (!managerInstance) {
    managerInstance = new MemoryManager();
    await managerInstance.initialize();
  }
  return managerInstance;
}
