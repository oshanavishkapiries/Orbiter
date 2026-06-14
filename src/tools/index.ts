import { getToolRegistry } from './registry.js';
import { saveCsvTool } from './save-csv.js';
import { saveJsonTool } from './save-json.js';
import { recallStepHistoryTool } from './recall-step-history.js';
import { recallDomSnapshotTool } from './recall-dom-snapshot.js';
import { recallSessionDataTool } from './recall-session-data.js';
import { storeMemoryTool } from './store-memory.js';
import { recallMemoryTool } from './recall-memory.js';
import { allDevTools } from './devtools.js';

let _initialized = false;

export function initializeTools(): void {
  if (_initialized) return;
  _initialized = true;

  getToolRegistry().registerAll([
    saveCsvTool,
    saveJsonTool,
    recallStepHistoryTool,
    recallDomSnapshotTool,
    recallSessionDataTool,
    storeMemoryTool,
    recallMemoryTool,
    ...allDevTools,
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
