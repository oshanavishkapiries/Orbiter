// Database
export { DatabaseConnection, getDb } from './database/connection.js';

// Repositories
export { MemoryRepository } from './database/repositories/memory-repository.js';
export {
  SelectorRepository,
  SelectorWithFallbacks,
} from './database/repositories/selector-repository.js';
export {
  ErrorPatternRepository,
  ErrorPatternWithConfidence,
} from './database/repositories/error-pattern-repository.js';

// Manager
export { MemoryManager, getMemoryManager } from './manager.js';
