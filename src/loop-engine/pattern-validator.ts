import { logger } from '../cli/ui/logger.js';
import { DetectedPattern, ExtractSchema, ExtractionRule } from './types.js';
import type { McpClient } from '../mcp/client.js';

export class PatternValidator {
  constructor(private mcpClient: McpClient) {}

  async validate(pattern: DetectedPattern): Promise<{
    valid: boolean;
    itemCount: number;
    sampleData: Record<string, any> | null;
    errors: string[];
  }> {
    const errors: string[] = [];

    const itemCount: number = await this.mcpClient
      .evaluate(
        `document.querySelectorAll(${JSON.stringify(pattern.itemSelector)}).length`,
      )
      .catch(() => 0);

    if (itemCount === 0) {
      return {
        valid: false,
        itemCount: 0,
        sampleData: null,
        errors: [`Item selector not found: ${pattern.itemSelector}`],
      };
    }

    logger.debug(`Pattern validation: found ${itemCount} items`);

    let sampleData: Record<string, any> | null = null;
    try {
      sampleData = await this.extractItemAtIndex(
        0,
        pattern.itemSelector,
        pattern.extractSchema,
      );
    } catch (error) {
      errors.push(`Extraction test failed: ${(error as Error).message}`);
    }

    if (sampleData) {
      for (const [field, value] of Object.entries(sampleData)) {
        if (!value) {
          errors.push(`Warning: field "${field}" is empty in first item`);
        }
      }
    }

    return {
      valid: errors.filter((e) => !e.startsWith('Warning')).length === 0,
      itemCount,
      sampleData,
      errors,
    };
  }

  async extractItemAtIndex(
    index: number,
    itemSelector: string,
    schema: ExtractSchema,
  ): Promise<Record<string, any>> {
    const schemaScript = this.buildSchemaScript(schema);
    const expression = `
      (() => {
        const items = document.querySelectorAll(${JSON.stringify(itemSelector)});
        const el = items[${index}];
        if (!el) return null;
        ${schemaScript}
        return extractFromEl(el);
      })()
    `;

    const result = await this.mcpClient.evaluate(expression);
    return (result as Record<string, any>) ?? {};
  }

  async extractAllItems(
    itemSelector: string,
    schema: ExtractSchema,
  ): Promise<Record<string, any>[]> {
    const schemaScript = this.buildSchemaScript(schema);
    const expression = `
      (() => {
        const items = Array.from(document.querySelectorAll(${JSON.stringify(itemSelector)}));
        ${schemaScript}
        return items.map(el => extractFromEl(el));
      })()
    `;

    const result = await this.mcpClient.evaluate(expression);
    return Array.isArray(result) ? result : [];
  }

  private buildSchemaScript(schema: ExtractSchema): string {
    const schemaEntries = Object.entries(schema).map(([field, rule]) => {
      const fieldJson = JSON.stringify(field);
      if (typeof rule === 'string') {
        return `
          {
            const found = el.querySelector(${JSON.stringify(rule)});
            result[${fieldJson}] = found ? (found.textContent || '').trim() || null : null;
          }
        `;
      }

      const r = rule as ExtractionRule;
      const selectorJson = JSON.stringify(r.selector);
      const fallbackJson = JSON.stringify(r.fallback ?? null);

      let extractCode: string;
      switch (r.method) {
        case 'attribute':
          extractCode = `found.getAttribute(${JSON.stringify(r.attribute || 'href')})`;
          break;
        case 'html':
          extractCode = `found.innerHTML`;
          break;
        case 'evaluate':
          extractCode = `(() => { try { return (${r.evaluateCode || 'node.textContent'}); } catch { return null; } }).call(found)`;
          break;
        default:
          extractCode = `(found.textContent || '').trim() || null`;
      }

      const transformCode = r.transform
        ? `
          if (value !== null && value !== undefined) {
            ${r.transform === 'trim' ? 'value = String(value).trim();' : ''}
            ${r.transform === 'lowercase' ? 'value = String(value).toLowerCase();' : ''}
            ${r.transform === 'uppercase' ? 'value = String(value).toUpperCase();' : ''}
            ${r.transform === 'number' ? 'value = parseFloat(String(value).replace(/[^0-9.-]/g, ""));' : ''}
          }
        `
        : '';

      return `
        {
          const found = el.querySelector(${selectorJson});
          if (!found) {
            result[${fieldJson}] = ${fallbackJson};
          } else {
            let value = ${extractCode};
            ${transformCode}
            result[${fieldJson}] = value ?? ${fallbackJson};
          }
        }
      `;
    });

    return `
      function extractFromEl(el) {
        const result = {};
        try {
          ${schemaEntries.join('\n')}
        } catch(e) {}
        return result;
      }
    `;
  }
}
