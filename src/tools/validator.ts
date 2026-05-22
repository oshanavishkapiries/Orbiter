import { getToolRegistry } from './registry.js';
import { ToolDefinition } from './types.js';

export interface ToolValidationResult {
  valid: boolean;
  error?: string;
}

export function validateToolCall(
  toolName: string,
  params: unknown,
): ToolValidationResult {
  const registry = getToolRegistry();
  const tool = registry.get(toolName);

  if (!tool) {
    if (toolName.startsWith('browser_')) {
      return {
        valid: false,
        error: `"${toolName}" is not in the MCP tool list. Check your available browser tools and use an exact name from the list.`,
      };
    }
    return {
      valid: false,
      error: `Unknown tool "${toolName}". Available custom tools: ${registry.getNames().join(', ')}`,
    };
  }

  if (!isPlainObject(params)) {
    return {
      valid: false,
      error: `Tool "${toolName}" expects an object for arguments.`,
    };
  }

  const schemaValidation = validateAgainstSchema(tool, params);
  if (!schemaValidation.valid) {
    return schemaValidation;
  }

  return validateToolSpecificRules(toolName, params);
}

function validateAgainstSchema(
  tool: ToolDefinition,
  params: Record<string, unknown>,
): ToolValidationResult {
  const { required = [], properties = {} } = tool.parameters;

  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      return {
        valid: false,
        error: `Tool "${tool.name}" is missing required field "${field}".`,
      };
    }
  }

  for (const [field, schema] of Object.entries(properties)) {
    const value = params[field];
    if (value === undefined || value === null) {
      continue;
    }

    const type = schema?.type;
    if (!type) {
      continue;
    }

    const typeError = validateType(field, type, value);
    if (typeError) {
      return {
        valid: false,
        error: `Tool "${tool.name}" field "${field}" ${typeError}`,
      };
    }

    if (Array.isArray(schema?.enum) && !schema.enum.includes(value)) {
      return {
        valid: false,
        error: `Tool "${tool.name}" field "${field}" must be one of: ${schema.enum.join(', ')}.`,
      };
    }
  }

  return { valid: true };
}

function validateToolSpecificRules(
  toolName: string,
  params: Record<string, unknown>,
): ToolValidationResult {
  switch (toolName) {
    case 'bulk_extract':
      return validateBulkExtractParams(params);
    case 'save_extracted_data':
      return validateSaveExtractedDataParams(params);
    case 'recall_dom_snapshot':
      return validatePositiveIntegerField(toolName, 'step_number', params);
    case 'recall_step_history': {
      const fromCheck = validatePositiveIntegerField(toolName, 'from_step', params);
      if (!fromCheck.valid) return fromCheck;
      const toCheck = validatePositiveIntegerField(toolName, 'to_step', params);
      if (!toCheck.valid) return toCheck;

      const fromStep = params.from_step as number | undefined;
      const toStep = params.to_step as number | undefined;
      if (
        typeof fromStep === 'number' &&
        typeof toStep === 'number' &&
        fromStep > toStep
      ) {
        return {
          valid: false,
          error: `Tool "${toolName}" requires from_step to be less than or equal to to_step.`,
        };
      }
      return { valid: true };
    }
    default:
      return { valid: true };
  }
}

function validateBulkExtractParams(
  params: Record<string, unknown>,
): ToolValidationResult {
  if (!isNonEmptyString(params.extractFn)) {
    return { valid: false, error: 'Tool "bulk_extract" requires "extractFn" to be a non-empty string.' };
  }
  if (!isPlainObject(params.pagination)) {
    return { valid: false, error: 'Tool "bulk_extract" requires "pagination" to be an object.' };
  }
  const { type } = params.pagination as Record<string, unknown>;
  if (type !== 'click_next' && type !== 'url_page' && type !== 'infinite_scroll') {
    return { valid: false, error: 'Tool "bulk_extract" pagination.type must be "click_next", "url_page", or "infinite_scroll".' };
  }
  if (type === 'click_next' && !isNonEmptyString((params.pagination as any).selector)) {
    return { valid: false, error: 'Tool "bulk_extract" pagination.selector is required for type "click_next".' };
  }
  if (type === 'url_page' && !isNonEmptyString((params.pagination as any).urlTemplate)) {
    return { valid: false, error: 'Tool "bulk_extract" pagination.urlTemplate is required for type "url_page".' };
  }
  return { valid: true };
}

function validateSaveExtractedDataParams(
  params: Record<string, unknown>,
): ToolValidationResult {
  if (!Array.isArray(params.data)) {
    return { valid: false, error: 'Tool "save_extracted_data" requires "data" to be an array.' };
  }
  if (params.data.length === 0) {
    return { valid: false, error: 'Tool "save_extracted_data" requires a non-empty "data" array.' };
  }
  return { valid: true };
}


function validatePositiveIntegerField(
  toolName: string,
  fieldName: string,
  params: Record<string, unknown>,
): ToolValidationResult {
  const value = params[fieldName];
  if (value === undefined) {
    return { valid: true };
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return {
      valid: false,
      error: `Tool "${toolName}" field "${fieldName}" must be a positive integer when provided.`,
    };
  }

  return { valid: true };
}

function validateType(
  field: string,
  type: string,
  value: unknown,
): string | null {
  switch (type) {
    case 'string':
      return typeof value === 'string' ? null : 'must be a string.';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? null
        : 'must be a finite number.';
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be a boolean.';
    case 'array':
      return Array.isArray(value) ? null : 'must be an array.';
    case 'object':
      return isPlainObject(value) ? null : 'must be an object.';
    default:
      return `has unsupported schema type "${type}" for validation of field "${field}".`;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
