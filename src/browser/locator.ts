import { Page, Locator } from 'playwright';

export interface LocatorSpec {
  role?: string;
  name?: string;
  label?: string;
  placeholder?: string;
  text?: string;
  testId?: string;
  selector?: string;
}

export const LOCATOR_PARAMS = {
  role: {
    type: 'string',
    description:
      'ARIA role from the snapshot (button, textbox, combobox, link, checkbox, heading, listitem, etc.)',
  },
  name: {
    type: 'string',
    description: 'Accessible name — always pair with role (e.g. role="button" name="Login")',
  },
  label: {
    type: 'string',
    description: 'Form label text (e.g. "Email", "Password")',
  },
  placeholder: {
    type: 'string',
    description: 'Input placeholder text visible in the snapshot',
  },
  text: {
    type: 'string',
    description: 'Visible text content of the element',
  },
  testId: {
    type: 'string',
    description: 'data-testid attribute value',
  },
  selector: {
    type: 'string',
    description: 'CSS selector — last resort when no semantic field applies',
  },
} as const;

export function resolveLocator(page: Page, spec: LocatorSpec): Locator {
  if (spec.role) {
    return page.getByRole(spec.role as any, spec.name ? { name: spec.name, exact: false } : undefined);
  }
  if (spec.label)       return page.getByLabel(spec.label, { exact: false });
  if (spec.placeholder) return page.getByPlaceholder(spec.placeholder, { exact: false });
  if (spec.text)        return page.getByText(spec.text, { exact: false });
  if (spec.testId)      return page.getByTestId(spec.testId);
  if (spec.selector)    return page.locator(spec.selector);
  throw new Error(
    'Provide at least one locator field: role, label, placeholder, text, testId, or selector',
  );
}

export function specDescription(spec: LocatorSpec): string {
  if (spec.role)        return spec.name ? `${spec.role} "${spec.name}"` : spec.role;
  if (spec.label)       return `label "${spec.label}"`;
  if (spec.placeholder) return `placeholder "${spec.placeholder}"`;
  if (spec.text)        return `text "${spec.text}"`;
  if (spec.testId)      return `testId "${spec.testId}"`;
  if (spec.selector)    return spec.selector;
  return '(empty spec)';
}
