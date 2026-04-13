import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { getMemoryManager } from '../memory/manager.js';
import { logger } from '../cli/ui/logger.js';

export const recallMemoryTool: ToolDefinition = {
  name: 'recall_memory',

  description: `
Recall learned information from Orbiter's memory database.

Use this to:
- Get previously learned CSS selectors for elements
- Find error recovery strategies that worked before
- Check what we know about a website

This can dramatically speed up automation by avoiding trial-and-error.
Memory is persistent across sessions.
  `,

  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Website domain (e.g., "google.com")',
      },
      queryType: {
        type: 'string',
        description: 'Type of memory to recall',
        enum: ['selector', 'error_recovery', 'all'],
      },
      elementName: {
        type: 'string',
        description:
          'Name of element to find selector for (e.g., "Login button", "Search input")',
      },
      errorType: {
        type: 'string',
        description: 'Type of error to find recovery for',
      },
      failedSelector: {
        type: 'string',
        description: 'The selector that failed (for error recovery lookup)',
      },
    },
    required: ['domain', 'queryType'],
  },

  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    try {
      const memory = getMemoryManager();
      const { domain, queryType, elementName, errorType, failedSelector } =
        params;

      // ─────────────────────────────────────────────
      // Selector lookup
      // ─────────────────────────────────────────────
      if (queryType === 'selector' && elementName) {
        const selector = memory.getSelector(domain, elementName);

        if (selector) {
          logger.debug(`Memory hit: selector for "${elementName}"`);

          return {
            success: true,
            message: `Found remembered selector for "${elementName}"`,
            data: {
              found: true,
              memoryId: selector.id,
              selector: selector.primary_selector,
              fallbacks: selector.fallbacks,
              confidence: `${(selector.confidence * 100).toFixed(0)}%`,
              usageCount: selector.usage_count,
              successRate:
                selector.usage_count > 0
                  ? `${((selector.success_count / selector.usage_count) * 100).toFixed(0)}%`
                  : 'N/A',
              hint: 'Use the selector directly. If it fails, try fallbacks in order.',
            },
          };
        }

        // Try search
        const searchResults = memory.searchSelectors(domain, elementName);

        if (searchResults.length > 0) {
          return {
            success: true,
            message: `No exact match, but found ${searchResults.length} similar selectors`,
            data: {
              found: false,
              similar: searchResults.slice(0, 5).map((s) => ({
                elementName: s.element_name,
                selector: s.primary_selector,
                confidence: `${(s.confidence * 100).toFixed(0)}%`,
              })),
            },
          };
        }

        return {
          success: true,
          message: `No memory found for "${elementName}" on ${domain}`,
          data: { found: false },
        };
      }

      // ─────────────────────────────────────────────
      // Error recovery lookup
      // ─────────────────────────────────────────────
      if (queryType === 'error_recovery' && errorType) {
        const recovery = memory.getErrorRecovery(
          domain,
          errorType,
          failedSelector,
        );

        if (recovery) {
          logger.debug(`Memory hit: error recovery for "${errorType}"`);

          return {
            success: true,
            message: `Found recovery strategy for "${errorType}"`,
            data: {
              found: true,
              memoryId: recovery.id,
              strategy: recovery.recovery_strategy,
              workingSelector: recovery.working_selector,
              failedSelector: recovery.failed_selector,
              context: recovery.context,
              confidence: `${(recovery.confidence * 100).toFixed(0)}%`,
              successRate:
                recovery.usage_count > 0
                  ? `${((recovery.success_count / recovery.usage_count) * 100).toFixed(0)}%`
                  : 'N/A',
            },
          };
        }

        return {
          success: true,
          message: `No error recovery found for "${errorType}" on ${domain}`,
          data: { found: false },
        };
      }

      // ─────────────────────────────────────────────
      // Get all domain info
      // ─────────────────────────────────────────────
      if (queryType === 'all') {
        const selectors = memory.getDomainSelectors(domain);
        const stats = memory.getStats();

        return {
          success: true,
          message: `Memory overview for ${domain}`,
          data: {
            domain,
            selectorCount: selectors.length,
            selectors: selectors.slice(0, 10).map((s) => ({
              element: s.element_name,
              type: s.element_type,
              selector: s.primary_selector,
              confidence: `${(s.confidence * 100).toFixed(0)}%`,
            })),
            databaseStats: {
              totalMemories: stats.memory.total,
              databaseSize: stats.database.size,
            },
          },
        };
      }

      return {
        success: true,
        message: 'No specific memory found',
        data: { found: false },
      };
    } catch (error) {
      logger.error(`Memory recall failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
