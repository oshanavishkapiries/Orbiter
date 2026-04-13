import fs from 'fs';
import { logger } from '../cli/ui/logger.js';
import { FlowParameter } from './schema.js';

export class ParameterEngine {
  private parameters: Record<string, string> = {};

  constructor(parameters: Record<string, string> = {}) {
    this.parameters = parameters;
  }

  /**
   * Load parameters from JSON file
   */
  loadFromFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Parameters file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);

    this.parameters = { ...this.parameters, ...parsed };
    logger.debug(`Loaded ${Object.keys(parsed).length} parameters from file`);
  }

  /**
   * Add parameters from JSON string
   */
  loadFromJson(jsonString: string): void {
    const parsed = JSON.parse(jsonString);
    this.parameters = { ...this.parameters, ...parsed };
    logger.debug(`Loaded ${Object.keys(parsed).length} parameters from JSON`);
  }

  /**
   * Substitute parameters in a value
   * {{PARAM_NAME}} → actual value
   */
  substitute(value: string): string {
    return value.replace(/\{\{([A-Z_]+)\}\}/g, (match, paramName) => {
      if (this.parameters[paramName] !== undefined) {
        return this.parameters[paramName];
      }
      logger.warn(`Parameter not found: {{${paramName}}}`);
      return match; // Return original if not found
    });
  }

  /**
   * Substitute parameters in entire params object
   */
  substituteParams(params: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        result[key] = this.substitute(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.substituteParams(value);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Validate required parameters are present
   */
  validate(requiredParams: FlowParameter[]): {
    valid: boolean;
    missing: string[];
  } {
    const missing: string[] = [];

    for (const param of requiredParams) {
      if (param.required && !this.parameters[param.name]) {
        missing.push(param.name);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get all parameters
   */
  getAll(): Record<string, string> {
    return { ...this.parameters };
  }

  /**
   * Set a parameter
   */
  set(name: string, value: string): void {
    this.parameters[name] = value;
  }
}
