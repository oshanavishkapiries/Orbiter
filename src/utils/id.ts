import { nanoid } from 'nanoid';

export function generateId(prefix?: string): string {
  const id = nanoid(10);
  return prefix ? `${prefix}_${id}` : id;
}

export function generateFlowId(): string {
  return generateId('flow');
}

export function generateStepId(): string {
  return generateId('step');
}

export function generateErrorId(): string {
  return generateId('err');
}