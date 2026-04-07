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

/**
 * Initialize and register all core tools
 */
export function initializeTools(): void {
  const registry = getToolRegistry();

  registry.registerAll([
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
  ]);
}

export { getToolRegistry } from './registry.js';
export * from './types.js';
