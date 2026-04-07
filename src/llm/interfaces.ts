import { Message, Tool, LLMResponse, LLMProvider } from './types.js';

export abstract class BaseLLMProvider implements LLMProvider {
  abstract name: string;

  abstract chat(messages: Message[], tools?: Tool[]): Promise<LLMResponse>;

  abstract supportsFunctionCalling(): boolean;

  /**
   * Format error messages
   */
  protected formatError(error: any): string {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  /**
   * Validate tools format
   */
  protected validateTools(tools?: Tool[]): void {
    if (!tools || tools.length === 0) return;

    for (const tool of tools) {
      if (!tool.name || !tool.description) {
        throw new Error(`Invalid tool: missing name or description`);
      }
      if (!tool.parameters || tool.parameters.type !== 'object') {
        throw new Error(
          `Invalid tool ${tool.name}: parameters must be object type`,
        );
      }
    }
  }
}
