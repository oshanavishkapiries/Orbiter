import { getToolRegistry } from './registry.js';
import { saveExtractedDataTool } from './save-extracted-data.js';
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
    saveExtractedDataTool,
    recallStepHistoryTool,
    recallDomSnapshotTool,
    recallSessionDataTool,
    storeMemoryTool,
    recallMemoryTool,
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
