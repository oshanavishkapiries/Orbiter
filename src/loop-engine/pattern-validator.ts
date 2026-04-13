import { Page } from 'playwright';
import { logger } from '../cli/ui/logger.js';
import {
  DetectedPattern,
  ExtractSchema,
  ExtractionRule,
  ExtractedItem,
} from './types.js';

export class PatternValidator {
  constructor(private page: Page) {}

  /**
   * Validate pattern on first item
   * Make sure selectors actually work
   */
  async validate(pattern: DetectedPattern): Promise<{
    valid: boolean;
    itemCount: number;
    sampleData: Record<string, any> | null;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Check item selector
    const items = await this.page.$$(pattern.itemSelector);

    if (items.length === 0) {
      return {
        valid: false,
        itemCount: 0,
        sampleData: null,
        errors: [`Item selector not found: ${pattern.itemSelector}`],
      };
    }

    logger.debug(`Pattern validation: found ${items.length} items`);

    // Test extraction on first item
    let sampleData: Record<string, any> | null = null;

    try {
      sampleData = await this.extractFromElement(
        items[0],
        pattern.extractSchema,
      );
    } catch (error) {
      errors.push(`Extraction test failed: ${(error as Error).message}`);
    }

    // Warn about empty fields
    if (sampleData) {
      for (const [field, value] of Object.entries(sampleData)) {
        if (!value) {
          errors.push(`Warning: field "${field}" is empty in first item`);
        }
      }
    }

    return {
      valid: errors.filter((e) => !e.startsWith('Warning')).length === 0,
      itemCount: items.length,
      sampleData,
      errors,
    };
  }

  /**
   * Extract data from a single element using schema
   */
  async extractFromElement(
    element: any,
    schema: ExtractSchema,
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [field, rule] of Object.entries(schema)) {
      try {
        if (typeof rule === 'string') {
          // Simple selector → get text
          const el = await element.$(rule);
          if (el) {
            const text = await el.textContent();
            result[field] = text?.trim() || null;
          } else {
            result[field] = null;
          }
        } else {
          // Complex rule
          result[field] = await this.extractWithRule(element, rule);
        }
      } catch (error) {
        result[field] = null;
        logger.debug(
          `Field "${field}" extraction error: ${(error as Error).message}`,
        );
      }
    }

    return result;
  }

  /**
   * Extract using complex rule
   */
  private async extractWithRule(
    element: any,
    rule: ExtractionRule,
  ): Promise<any> {
    const el = await element.$(rule.selector);

    if (!el) {
      return rule.fallback || null;
    }

    let value: any;

    switch (rule.method) {
      case 'text':
        value = await el.textContent();
        value = value?.trim() || null;
        break;

      case 'attribute':
        value = await el.getAttribute(rule.attribute || 'href');
        break;

      case 'html':
        value = await el.innerHTML();
        break;

      case 'evaluate':
        value = await el.evaluate((node: Element, code: string) => {
          const expression = new Function(
            'node',
            `"use strict"; return (${code});`,
          );
          return expression(node);
        }, rule.evaluateCode || 'node.textContent');
        break;

      default:
        value = await el.textContent();
        value = value?.trim() || null;
    }

    // Apply transform
    if (value && rule.transform) {
      switch (rule.transform) {
        case 'trim':
          value = String(value).trim();
          break;
        case 'lowercase':
          value = String(value).toLowerCase();
          break;
        case 'uppercase':
          value = String(value).toUpperCase();
          break;
        case 'number':
          value = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          break;
      }
    }

    return value ?? rule.fallback ?? null;
  }
}
