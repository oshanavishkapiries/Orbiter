import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { getMemoryManager, MemoryManager } from '../memory/manager.js';
import { logger } from '../cli/ui/logger.js';

export const storeMemoryTool: ToolDefinition = {
  name: 'store_memory',

  description: `
Store learned information in Orbiter's memory database for future use.

Use this to remember:
- Working CSS selectors for elements
- Error recovery strategies
- Any discoveries that should be reused

This makes Orbiter smarter over time - always store successful findings!
  `,

  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Website domain (e.g., "google.com")',
      },
      memoryType: {
        type: 'string',
        description: 'Type of memory to store',
        enum: ['selector', 'error_recovery'],
      },

      // For selector memory
      elementName: {
        type: 'string',
        description: 'Human-readable name of element (e.g., "Login button")',
      },
      elementType: {
        type: 'string',
        description: 'Element type: button, input, link, select, etc.',
      },
      selector: {
        type: 'string',
        description: 'Working CSS selector',
      },
      fallbackSelectors: {
        type: 'array',
        description: 'Alternative selectors that also work',
        items: { type: 'string' },
      },

      // For error recovery memory
      errorType: {
        type: 'string',
        description: 'Type of error that occurred',
      },
      failedSelector: {
        type: 'string',
        description: 'Selector that failed',
      },
      workingSelector: {
        type: 'string',
        description: 'Selector that worked as recovery',
      },
      recoveryStrategy: {
        type: 'string',
        description: 'Strategy used to recover',
      },
      context: {
        type: 'string',
        description: 'Additional context about the error',
      },
    },
    required: ['domain', 'memoryType'],
  },

  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const memory = await getMemoryManager();

      // ─────────────────────────────────────────────
      // Store selector
      // ─────────────────────────────────────────────
      if (params.memoryType === 'selector') {
        if (!params.elementName || !params.selector) {
          return {
            success: false,
            error: 'elementName and selector are required for selector memory',
          };
        }

        const existing = await memory.getSelector(
          params.domain,
          params.elementName,
        );

        if (existing) {
          if (existing.primary_selector !== params.selector) {
            await memory.addSelectorFallback(existing.id, params.selector);

            return {
              success: true,
              message: `Added as fallback to existing selector for "${params.elementName}"`,
              data: {
                memoryId: existing.id,
                action: 'added_fallback',
                existingSelector: existing.primary_selector,
                newFallback: params.selector,
              },
            };
          }

          return {
            success: true,
            message: `Selector already remembered for "${params.elementName}"`,
            data: {
              memoryId: existing.id,
              action: 'already_exists',
            },
          };
        }

        const entry = await memory.rememberSelector({
          domain: params.domain,
          elementName: params.elementName,
          elementType: params.elementType || 'unknown',
          primarySelector: params.selector,
          fallbacks: params.fallbackSelectors || [],
          learnedFrom: 'execution',
        });

        return {
          success: true,
          message: `Remembered selector for "${params.elementName}"`,
          data: {
            memoryId: entry.id,
            action: 'created',
            stored: {
              element: params.elementName,
              selector: params.selector,
              fallbacks: params.fallbackSelectors || [],
            },
          },
        };
      }

      // ─────────────────────────────────────────────
      // Store error recovery
      // ─────────────────────────────────────────────
      if (params.memoryType === 'error_recovery') {
        if (!params.errorType || !params.recoveryStrategy) {
          return {
            success: false,
            error:
              'errorType and recoveryStrategy are required for error recovery memory',
          };
        }

        const entry = await memory.rememberErrorRecovery({
          domain: params.domain,
          errorType: params.errorType,
          failedSelector: params.failedSelector,
          workingSelector: params.workingSelector,
          recoveryStrategy: params.recoveryStrategy,
          context: params.context,
        });

        return {
          success: true,
          message: `Remembered error recovery for "${params.errorType}"`,
          data: {
            memoryId: entry.id,
            action: 'created',
            stored: {
              errorType: params.errorType,
              strategy: params.recoveryStrategy,
              workingSelector: params.workingSelector,
            },
          },
        };
      }

      return {
        success: false,
        error: `Unknown memory type: ${params.memoryType}`,
      };
    } catch (error) {
      logger.error(`Memory store failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
