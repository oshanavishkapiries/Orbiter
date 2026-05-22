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

const ARIA_ROLES = new Set([
  'button', 'textbox', 'combobox', 'checkbox', 'radio', 'link', 'heading',
  'listitem', 'list', 'img', 'grid', 'row', 'cell', 'tab', 'tabpanel',
  'dialog', 'alert', 'navigation', 'main', 'region', 'article', 'menu',
  'menuitem', 'option', 'searchbox', 'slider', 'spinbutton', 'switch',
  'tooltip', 'treeitem', 'columnheader', 'rowheader', 'separator',
]);

export function resolveLocator(page: Page, spec: LocatorSpec): Locator {
  if (spec.role) {
    return page.getByRole(spec.role as any, spec.name ? { name: spec.name, exact: false } : undefined);
  }
  if (spec.label)       return page.getByLabel(spec.label, { exact: false });
  if (spec.placeholder) return page.getByPlaceholder(spec.placeholder, { exact: false });
  if (spec.text)        return page.getByText(spec.text, { exact: false });
  if (spec.testId)      return page.getByTestId(spec.testId);
  if (spec.selector)    return page.locator(spec.selector);

  // Detect the common mistake of using an ARIA role name as a key.
  // e.g. { textbox: "course-url-slug" } instead of { role: "textbox", name: "course-url-slug" }
  const passed = Object.keys(spec as Record<string, any>);
  const roleKey = passed.find((k) => ARIA_ROLES.has(k));
  if (roleKey) {
    const nameValue = (spec as any)[roleKey];
    throw new Error(
      `"${roleKey}" is not a valid locator field. ` +
      `Snapshot line "- ${roleKey} \\"${nameValue}\\"" maps to: role="${roleKey}", name="${nameValue}". ` +
      `Use: { role: "${roleKey}", name: "${nameValue}" }`,
    );
  }

  throw new Error(
    `Provide at least one locator field: role, label, placeholder, text, testId, or selector. ` +
    `You passed: ${JSON.stringify(spec)}`,
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
