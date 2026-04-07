import { logger } from '../cli/ui/logger.js';
import { ToolDefinition } from './types.js';
import { Tool } from '../llm/types.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /**
   * Register a tool
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`);
    }

    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool: ${tool.name}`);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tools in LLM format
   */
  getToolsForLLM(): Tool[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Execute a tool
   */
  async execute(name: string, params: any, context: any): Promise<any> {
    const tool = this.get(name);

    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    logger.debug(`Executing tool: ${name}`, { params });

    try {
      const result = await tool.execute(params, context);

      if (!result.success) {
        logger.warn(`Tool ${name} failed: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error(`Tool ${name} execution error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Get registry stats
   */
  getStats(): { total: number; names: string[] } {
    return {
      total: this.tools.size,
      names: this.getNames(),
    };
  }
}

// Singleton instance
let registryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}
