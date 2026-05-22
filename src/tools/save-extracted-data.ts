import { ToolDefinition, ToolResult } from './types.js';

export const saveExtractedDataTool: ToolDefinition = {
  name: 'save_extracted_data',
  description:
    'Save a pre-collected data array to CSV and JSON files. Use this after collecting data via browser_evaluate on SPAs (Google Maps, React apps) where CSS selectors cannot reach the DOM. Pass the exact array returned by browser_evaluate.',
  parameters: {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        description: 'Array of records to save — each record must be an object with consistent keys',
      },
    },
    required: ['data'],
  },
  execute: async (params): Promise<ToolResult> => {
    const { data } = params;

    if (!Array.isArray(data) || data.length === 0) {
      return { success: false, error: 'data must be a non-empty array of records' };
    }

    const nonObjects = data.filter((item) => typeof item !== 'object' || item === null || Array.isArray(item));
    if (nonObjects.length > 0) {
      return { success: false, error: 'Every item in data must be a plain object (e.g. { name: "...", rating: "..." })' };
    }

    return {
      success: true,
      message: `Queued ${data.length} records for export to CSV and JSON`,
      data,
    };
  },
};
