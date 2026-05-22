import { Page } from 'playwright';
import { config } from '../config/index.js';
import { logger } from '../cli/ui/logger.js';

export interface InteractiveElement {
  type: 'input' | 'button' | 'link' | 'select' | 'textarea' | 'checkbox' | 'radio';
  selector: string;
  label: string;
  placeholder?: string;
  href?: string;
}

export interface FormInfo {
  id: string;
  action: string;
  fields: string[];
}

export interface PageIntelligence {
  url: string;
  title: string;
  pageType: string;
  summary: string;
  inputs: InteractiveElement[];
  buttons: InteractiveElement[];
  links: InteractiveElement[];
  selects: InteractiveElement[];
  checkboxes: InteractiveElement[];
  forms: FormInfo[];
  axTree: string;
}

// ─── JS scanner (runs inside the browser) ────────────────────────────────────
// Passed as a string so tsx doesn't inject __name() helper calls into it.

const SCANNER_SCRIPT = `
(function() {
  function isVisible(el) {
    var rect = el.getBoundingClientRect();
    var style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
           style.visibility !== 'hidden' &&
           style.display !== 'none' &&
           style.opacity !== '0';
  }

  function getBestSelector(el) {
    var tag = el.tagName.toLowerCase();
    var type = (el.type || '').toLowerCase();
    var isButton = tag === 'button' || type === 'submit' || type === 'button' || type === 'reset' || el.getAttribute('role') === 'button';

    if (el.id) return '#' + el.id;

    var testid = el.getAttribute('data-testid');
    if (testid) return '[data-testid="' + testid + '"]';

    // For buttons: prefer aria-label (unique, semantic) over name (often duplicated)
    var ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && isButton) return tag + '[aria-label="' + ariaLabel + '"]';

    // For text inputs: name is usually unique and stable
    var name = el.getAttribute('name');
    if (name && !isButton) return tag + '[name="' + name + '"]';

    // aria-label for non-buttons
    if (ariaLabel) return tag + '[aria-label="' + ariaLabel + '"]';

    // name for buttons as fallback (may not be unique)
    if (name) return tag + '[name="' + name + '"]';

    var placeholder = el.getAttribute('placeholder');
    if (placeholder) return tag + '[placeholder="' + placeholder + '"]';

    // submit buttons: use value text
    if (type === 'submit') {
      var val = el.getAttribute('value');
      if (val) return tag + '[type="submit"][value="' + val + '"]';
    }

    var parent = el.parentElement;
    if (parent) {
      var siblings = Array.prototype.filter.call(parent.children, function(c) { return c.tagName === el.tagName; });
      var idx = siblings.indexOf(el);
      var parentSel = parent.id ? '#' + parent.id : parent.tagName.toLowerCase();
      return parentSel + ' > ' + tag + (siblings.length > 1 ? ':nth-of-type(' + (idx + 1) + ')' : '');
    }
    return tag;
  }

  function getLabel(el) {
    var a = el.getAttribute('aria-label');
    if (a) return a.trim();
    var lby = el.getAttribute('aria-labelledby');
    if (lby) {
      var lel = document.getElementById(lby);
      if (lel) return (lel.textContent || '').trim();
    }
    if (el.id) {
      var lbl = document.querySelector('label[for="' + el.id + '"]');
      if (lbl) return (lbl.textContent || '').trim();
    }
    var ph = el.getAttribute('placeholder');
    if (ph) return ph;
    var ti = el.getAttribute('title');
    if (ti) return ti;
    return (el.textContent || '').trim().slice(0, 60);
  }

  var inputs = [], buttons = [], links = [], selects = [], checkboxes = [];

  // Text inputs & textareas
  var inputEls = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]');
  for (var i = 0; i < inputEls.length; i++) {
    var inp = inputEls[i];
    if (!isVisible(inp)) continue;
    inputs.push({
      type: inp.tagName.toLowerCase() === 'textarea' ? 'textarea' : 'input',
      selector: getBestSelector(inp),
      label: getLabel(inp),
      placeholder: inp.getAttribute('placeholder') || undefined
    });
  }

  // Checkboxes & radios
  var checkEls = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
  for (var c = 0; c < checkEls.length; c++) {
    var chk = checkEls[c];
    if (!isVisible(chk)) continue;
    checkboxes.push({ type: chk.type, selector: getBestSelector(chk), label: getLabel(chk) });
  }

  // Selects
  var selectEls = document.querySelectorAll('select');
  for (var s = 0; s < selectEls.length; s++) {
    var sel = selectEls[s];
    if (!isVisible(sel)) continue;
    var opts = Array.prototype.map.call(sel.options, function(o) { return o.text; }).slice(0, 6).join(', ');
    selects.push({ type: 'select', selector: getBestSelector(sel), label: getLabel(sel) + (opts ? ' [' + opts + ']' : '') });
  }

  // Buttons
  var btnEls = document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="reset"], [role="button"]');
  for (var b = 0; b < btnEls.length; b++) {
    var btn = btnEls[b];
    if (!isVisible(btn)) continue;
    buttons.push({ type: 'button', selector: getBestSelector(btn), label: getLabel(btn) });
  }

  // Links (max 20 visible)
  var linkEls = document.querySelectorAll('a[href]');
  var linkCount = 0;
  for (var l = 0; l < linkEls.length; l++) {
    if (linkCount >= 20) break;
    var a = linkEls[l];
    if (!isVisible(a)) continue;
    var lt = (a.textContent || '').trim();
    if (!lt) continue;
    links.push({ type: 'link', selector: getBestSelector(a), label: lt.slice(0, 80), href: a.href.slice(0, 120) });
    linkCount++;
  }

  // Forms
  var forms = [];
  var formEls = document.querySelectorAll('form');
  for (var f = 0; f < formEls.length; f++) {
    var form = formEls[f];
    var fields = [];
    var fInputs = form.querySelectorAll('input:not([type="hidden"]), textarea, select, button[type="submit"]');
    for (var fi = 0; fi < fInputs.length; fi++) {
      var fl = getLabel(fInputs[fi]);
      if (fl) fields.push(fl);
    }
    forms.push({ id: form.id || ('form-' + f), action: form.action || '', fields: fields });
  }

  // Page type detection
  var hasPassword = !!document.querySelector('input[type="password"]');
  var hasSearch = !!document.querySelector('input[type="search"], input[name="q"], [role="searchbox"]');
  var hasTable = !!document.querySelector('table, [role="grid"]');
  var hasFeed = !!document.querySelector('[role="feed"], article');
  var pageType = hasPassword ? 'login/auth' : hasSearch ? 'search' : hasTable ? 'data-table' : hasFeed ? 'content-feed' : forms.length ? 'form' : 'general';

  var summary = 'Page type: ' + pageType + '. '
    + inputs.length + ' input(s), '
    + buttons.length + ' button(s), '
    + links.length + ' link(s), '
    + selects.length + ' select(s), '
    + forms.length + ' form(s).';

  return { inputs, buttons, links, selects, checkboxes, forms, pageType, summary,
           url: location.href, title: document.title };
})()
`;

const HIGHLIGHT_CSS = `
  [data-orbiter-hl="input"]    { outline: 2px solid #ff4444 !important; outline-offset: 2px; }
  [data-orbiter-hl="textarea"] { outline: 2px solid #ff8800 !important; outline-offset: 2px; }
  [data-orbiter-hl="button"]   { outline: 2px solid #4488ff !important; outline-offset: 2px; }
  [data-orbiter-hl="link"]     { outline: 2px solid #44cc44 !important; outline-offset: 2px; }
  [data-orbiter-hl="select"]   { outline: 2px solid #cc44cc !important; outline-offset: 2px; }
  [data-orbiter-hl="checkbox"],
  [data-orbiter-hl="radio"]    { outline: 2px solid #ff4444 !important; outline-offset: 2px; }
`;

const LEGEND_HTML = `
  var legend = document.createElement('div');
  legend.id = '__orbiter_legend';
  legend.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483647;background:rgba(0,0,0,0.85);color:#fff;font:11px/1.7 monospace;padding:8px 12px;border-radius:6px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.5)';
  legend.innerHTML = '<b>🔬 Orbiter Scanner</b><br>'
    + '<span style="color:#ff4444">■</span> input/checkbox  '
    + '<span style="color:#4488ff">■</span> button<br>'
    + '<span style="color:#44cc44">■</span> link  '
    + '<span style="color:#cc44cc">■</span> select  '
    + '<span style="color:#ff8800">■</span> textarea';
  document.body.appendChild(legend);
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scanPage(page: Page): Promise<PageIntelligence> {
  try {
    const raw: any = await page.evaluate(SCANNER_SCRIPT);

    // AX tree via page.ariaSnapshot() (Playwright 1.46+)
    let axTree = '';
    try {
      axTree = await (page as any).ariaSnapshot();
      // Keep it concise — first 50 lines
      axTree = axTree.split('\n').slice(0, 50).join('\n');
    } catch {
      axTree = '(AX tree unavailable)';
    }

    return { ...raw, axTree };
  } catch (error) {
    logger.debug(`Page intelligence scan failed: ${(error as Error).message}`);
    return {
      url: page.url(),
      title: '',
      pageType: 'unknown',
      summary: 'Scan failed.',
      inputs: [], buttons: [], links: [], selects: [], checkboxes: [], forms: [],
      axTree: '',
    };
  }
}

export async function injectHighlights(page: Page, intel: PageIntelligence): Promise<void> {
  const cfg = config();
  if (cfg.browser.headless) return; // highlights only visible in headed mode

  try {
    // Remove previous highlights
    await page.evaluate(`
      (function() {
        var s = document.getElementById('__orbiter_hl_style');
        if (s) s.remove();
        var l = document.getElementById('__orbiter_legend');
        if (l) l.remove();
        document.querySelectorAll('[data-orbiter-hl]').forEach(function(e) {
          e.removeAttribute('data-orbiter-hl');
        });
      })()
    `);

    // Inject CSS
    await page.evaluate(
      `(function(css) {
        var s = document.createElement('style');
        s.id = '__orbiter_hl_style';
        s.textContent = css;
        document.head.appendChild(s);
        ${LEGEND_HTML}
      })(${JSON.stringify(HIGHLIGHT_CSS)})`,
    );

    // Tag elements
    const allElements = [
      ...intel.inputs,
      ...intel.buttons,
      ...intel.links,
      ...intel.selects,
      ...intel.checkboxes,
    ];

    for (const el of allElements) {
      try {
        await page.evaluate(
          `(function(sel, type) {
            try {
              var els = document.querySelectorAll(sel);
              els.forEach(function(e) { e.setAttribute('data-orbiter-hl', type); });
            } catch(_) {}
          })(${JSON.stringify(el.selector)}, ${JSON.stringify(el.type)})`,
        );
      } catch (_) {
        // ignore bad selectors
      }
    }
  } catch (error) {
    logger.debug(`Highlight injection failed: ${(error as Error).message}`);
  }
}

export function formatForLLM(intel: PageIntelligence): string {
  const lines: string[] = [
    `=== PAGE INTELLIGENCE ===`,
    `URL:       ${intel.url}`,
    `Title:     ${intel.title}`,
    `Type:      ${intel.pageType}`,
    `Summary:   ${intel.summary}`,
    '',
  ];

  if (intel.inputs.length) {
    lines.push(`INPUT FIELDS (${intel.inputs.length}):`);
    intel.inputs.forEach((e) => {
      lines.push(`  selector: ${e.selector}`);
      lines.push(`  label:    ${e.label}${e.placeholder ? `  hint: "${e.placeholder}"` : ''}`);
    });
    lines.push('');
  }

  if (intel.selects.length) {
    lines.push(`DROPDOWNS (${intel.selects.length}):`);
    intel.selects.forEach((e) => lines.push(`  ${e.selector}  — ${e.label}`));
    lines.push('');
  }

  if (intel.checkboxes.length) {
    lines.push(`CHECKBOXES/RADIOS (${intel.checkboxes.length}):`);
    intel.checkboxes.forEach((e) => lines.push(`  [${e.type}] ${e.selector}  — ${e.label}`));
    lines.push('');
  }

  if (intel.buttons.length) {
    lines.push(`BUTTONS (${intel.buttons.length}):`);
    intel.buttons.forEach((e) => lines.push(`  ${e.selector}  — "${e.label}"`));
    lines.push('');
  }

  if (intel.links.length) {
    lines.push(`LINKS (${intel.links.length}):`);
    intel.links.slice(0, 15).forEach((e) => lines.push(`  "${e.label}"  →  ${e.href}`));
    if (intel.links.length > 15) lines.push(`  ... and ${intel.links.length - 15} more`);
    lines.push('');
  }

  if (intel.forms.length) {
    lines.push(`FORMS (${intel.forms.length}):`);
    intel.forms.forEach((f) => {
      lines.push(`  #${f.id}: [${f.fields.join(', ')}]`);
      if (f.action) lines.push(`  action: ${f.action}`);
    });
    lines.push('');
  }

  if (intel.axTree) {
    lines.push(`ACCESSIBILITY TREE:`);
    intel.axTree.split('\n').forEach((l) => lines.push(`  ${l}`));
  }

  return lines.join('\n');
}
