import { getToolRegistry } from './registry.js';
import { navigateTool } from './navigate.js';
import { clickTool } from './click.js';
import { typeTool } from './type.js';
import { fillTool } from './fill.js';
import { scrollTool } from './scroll.js';
import { waitTool } from './wait.js';
import { screenshotTool } from './screenshot.js';
import { extractTextTool } from './extract-text.js';
import { extractDataTool } from './extract-data.js';
import { hoverTool } from './hover.js';
import { selectTool } from './select.js';
import { evaluateTool } from './evaluate.js';
import { detectPatternTool } from './detect-pattern.js';
import { analyzePageTool } from './analyze-page.js';
import { probeSelectorsTool } from './probe-selectors.js';

/**
 * Initialize and register all core tools
 */
export function initializeTools(): void {
  const registry = getToolRegistry();

  registry.registerAll([
    analyzePageTool,
    probeSelectorsTool,
    navigateTool,
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
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
