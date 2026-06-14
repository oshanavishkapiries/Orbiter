import { McpClient } from '../mcp/client.js';

const STYLE_ID = '__orb_hl__';

// Injected after every tool call when --highlight is active.
// Uses outline + box-shadow so layout is never affected.
const INJECT_SCRIPT = `(function(){
  const prev = document.getElementById('${STYLE_ID}');
  if (prev) prev.remove();
  const s = document.createElement('style');
  s.id = '${STYLE_ID}';
  s.textContent = \`
    /* buttons */
    button:not([disabled]),
    [role="button"]:not([aria-disabled="true"]),
    input[type="button"]:not([disabled]),
    input[type="submit"]:not([disabled]),
    input[type="reset"]:not([disabled]) {
      outline: 2px solid rgba(99,102,241,0.9) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(99,102,241,0.15), 0 0 12px rgba(99,102,241,0.3) !important;
    }

    /* text inputs */
    input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([disabled]),
    textarea:not([disabled]),
    select:not([disabled]),
    [role="textbox"],
    [role="combobox"],
    [role="searchbox"],
    [contenteditable="true"] {
      outline: 2px solid rgba(34,197,94,0.9) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(34,197,94,0.12), 0 0 10px rgba(34,197,94,0.25) !important;
    }

    /* checkboxes and radios */
    input[type="checkbox"]:not([disabled]),
    input[type="radio"]:not([disabled]) {
      outline: 2px solid rgba(168,85,247,0.9) !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 8px rgba(168,85,247,0.35) !important;
    }

    /* links */
    a[href]:not([role="button"]):not([role="tab"]) {
      outline: 2px solid rgba(245,158,11,0.85) !important;
      outline-offset: 1px !important;
      box-shadow: 0 0 8px rgba(245,158,11,0.2) !important;
    }

    /* selected / checked / pressed */
    [aria-selected="true"],
    [aria-checked="true"],
    [aria-pressed="true"],
    [aria-expanded="true"] {
      outline: 2px solid rgba(249,115,22,0.9) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(249,115,22,0.15), 0 0 10px rgba(249,115,22,0.3) !important;
    }

    /* tabs, menu items, options */
    [role="tab"],
    [role="menuitem"],
    [role="option"],
    [role="treeitem"] {
      outline: 1px dashed rgba(168,85,247,0.75) !important;
      outline-offset: 1px !important;
    }
  \`;
  try { document.head.appendChild(s); } catch(e) {}
})()`;

const REMOVE_SCRIPT = `(function(){
  const el = document.getElementById('${STYLE_ID}');
  if (el) el.remove();
})()`;

export class ElementHighlighter {
  private enabled: boolean;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  async inject(mcpClient: McpClient): Promise<void> {
    if (!this.enabled) return;
    try {
      await mcpClient.evaluate(INJECT_SCRIPT);
    } catch {
      // Silently ignore — page may be mid-navigation
    }
  }

  async remove(mcpClient: McpClient): Promise<void> {
    if (!this.enabled) return;
    try {
      await mcpClient.evaluate(REMOVE_SCRIPT);
    } catch {}
  }
}
