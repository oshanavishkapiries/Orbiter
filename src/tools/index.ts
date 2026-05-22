import { getToolRegistry } from './registry.js';
import { navigateTool } from './navigate.js';
import { snapshotTool } from './snapshot.js';
import { clickTool } from './click.js';
import { typeTool } from './type.js';
import { fillTool } from './fill.js';
import { scrollTool } from './scroll.js';
import { hoverTool } from './hover.js';
import { selectTool } from './select.js';
import { waitTool } from './wait.js';
import { screenshotTool } from './screenshot.js';
import { extractTextTool } from './extract-text.js';
import { extractDataTool } from './extract-data.js';
import { evaluateTool } from './evaluate.js';
import { detectPatternTool } from './detect-pattern.js';
import { recallStepHistoryTool } from './recall-step-history.js';
import { recallDomSnapshotTool } from './recall-dom-snapshot.js';
import { recallSessionDataTool } from './recall-session-data.js';

let _initialized = false;

export function initializeTools(): void {
  if (_initialized) return;
  _initialized = true;

  getToolRegistry().registerAll([
    navigateTool,
    snapshotTool,
    clickTool,
    typeTool,
    fillTool,
    scrollTool,
    hoverTool,
    selectTool,
    waitTool,
    screenshotTool,
    extractTextTool,
    extractDataTool,
    evaluateTool,
    detectPatternTool,
    recallStepHistoryTool,
    recallDomSnapshotTool,
    recallSessionDataTool,
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
