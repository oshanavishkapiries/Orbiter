import { ExecutionContext } from '../core/execution-context.js';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: any, context: ExecutionContext) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  screenshot?: string;
  // Set by screenshot tool when the active LLM supports vision.
  // The executor injects this as an image_url message so the model actually sees the page.
  imageBase64?: string;
}
