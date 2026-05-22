import { getToolRegistry } from './registry.js';
import { extractTextTool } from './extract-text.js';
import { extractDataTool } from './extract-data.js';
import { saveExtractedDataTool } from './save-extracted-data.js';
import { detectPatternTool } from './detect-pattern.js';
import { recallStepHistoryTool } from './recall-step-history.js';
import { recallDomSnapshotTool } from './recall-dom-snapshot.js';
import { recallSessionDataTool } from './recall-session-data.js';
import { storeMemoryTool } from './store-memory.js';
import { recallMemoryTool } from './recall-memory.js';

let _initialized = false;

export function initializeTools(): void {
  if (_initialized) return;
  _initialized = true;

  getToolRegistry().registerAll([
    extractTextTool,
    extractDataTool,
    saveExtractedDataTool,
    detectPatternTool,
    recallStepHistoryTool,
    recallDomSnapshotTool,
    recallSessionDataTool,
    storeMemoryTool,
    recallMemoryTool,
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
