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
    return {
      valid: false,
      error: `Unknown tool "${toolName}". Use one of: ${registry.getNames().join(', ')}`,
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
    case 'wait':
      return validateWaitParams(params);
    case 'extract_data':
      return validateExtractDataParams(params);
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

function validateWaitParams(
  params: Record<string, unknown>,
): ToolValidationResult {
  if (params.type === 'selector') {
    if (!isNonEmptyString(params.selector)) {
      return {
        valid: false,
        error: 'Tool "wait" requires a non-empty "selector" when type="selector".',
      };
    }
  }

  if (params.type === 'time') {
    if (typeof params.duration !== 'number' || params.duration <= 0) {
      return {
        valid: false,
        error: 'Tool "wait" requires a positive numeric "duration" when type="time".',
      };
    }
  }

  return { valid: true };
}

function validateExtractDataParams(
  params: Record<string, unknown>,
): ToolValidationResult {
  if (!isPlainObject(params.schema)) {
    return {
      valid: false,
      error: 'Tool "extract_data" requires "schema" to be an object.',
    };
  }

  const entries = Object.entries(params.schema);
  if (entries.length === 0) {
    return {
      valid: false,
      error: 'Tool "extract_data" requires a non-empty "schema" object.',
    };
  }

  for (const [field, selector] of entries) {
    if (!isNonEmptyString(selector)) {
      return {
        valid: false,
        error: `Tool "extract_data" schema field "${field}" must map to a non-empty selector string.`,
      };
    }
  }

  if (
    params.containerSelector !== undefined &&
    !isNonEmptyString(params.containerSelector)
  ) {
    return {
      valid: false,
      error: 'Tool "extract_data" field "containerSelector" must be a non-empty string when provided.',
    };
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
