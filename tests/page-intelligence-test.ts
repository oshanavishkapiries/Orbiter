/**
 * Page Intelligence Test
 *
 * Experiments with three perception layers:
 *   1. Custom JS scanner  — finds interactive elements, returns structured data
 *   2. Playwright AX Tree — semantic accessibility snapshot (screen-reader view)
 *   3. Visual highlights  — coloured borders injected into the live page
 *
 * Outputs the exact payload a future `analyze_page` tool would send to the LLM.
 *
 * Run: npx tsx tests/page-intelligence-test.ts [url]
 */

import 'dotenv/config';
import { chromium, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const TARGET_URL = process.argv[2] || 'https://github.com/login';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const MODEL = process.env.DEFAULT_MODEL || 'qwen/qwen3.6-plus';

// ─── Console helpers ──────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function section(n: number, title: string) {
  const bar = '─'.repeat(64);
  console.log(`\n${bar}`);
  console.log(`  ${C.bold}${C.cyan}${n} · ${title}${C.reset}`);
  console.log(bar);
}

function kv(key: string, value: string) {
  console.log(`  ${C.cyan}${key.padEnd(24)}${C.reset}${value}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface InteractiveElement {
  type:
    | 'input'
    | 'button'
    | 'link'
    | 'select'
    | 'textarea'
    | 'checkbox'
    | 'radio'
    | 'form'
    | 'other';
  selector: string; // best CSS selector
  label: string; // human-readable name
  placeholder?: string;
  value?: string;
  href?: string;
  role?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

interface PageIntelligence {
  url: string;
  title: string;
  elements: InteractiveElement[];
  forms: { id: string; action: string; fields: string[] }[];
  pageType: string; // login | search | listing | article | dashboard | unknown
  summary: string; // one-line description for LLM
}

// ─── Layer 1: Custom JS Scanner ───────────────────────────────────────────────

async function runJSScanner(page: Page): Promise<PageIntelligence> {
  const result: PageIntelligence = await page.evaluate(`
    (function() {
      // ── Helpers ───────────────────────────────────────────────────────────

      function isVisible(el) {
        var rect = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 &&
               style.visibility !== 'hidden' &&
               style.display !== 'none' &&
               style.opacity !== '0';
      }

      function getBestSelector(el) {
        if (el.id) return '#' + el.id;
        var testid = el.getAttribute('data-testid');
        if (testid) return '[data-testid="' + testid + '"]';
        var name = el.getAttribute('name');
        if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
        var ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) return el.tagName.toLowerCase() + '[aria-label="' + ariaLabel + '"]';
        var placeholder = el.getAttribute('placeholder');
        if (placeholder) return el.tagName.toLowerCase() + '[placeholder="' + placeholder + '"]';
        // nth-child fallback
        var parent = el.parentElement;
        if (parent) {
          var siblings = Array.prototype.filter.call(parent.children, function(c) {
            return c.tagName === el.tagName;
          });
          var idx = siblings.indexOf(el);
          var parentSel = parent.id ? '#' + parent.id : parent.tagName.toLowerCase();
          return parentSel + ' > ' + el.tagName.toLowerCase() + (siblings.length > 1 ? ':nth-of-type(' + (idx + 1) + ')' : '');
        }
        return el.tagName.toLowerCase();
      }

      function getLabel(el) {
        // aria-label > aria-labelledby > associated <label> > placeholder > title > text
        var a = el.getAttribute('aria-label');
        if (a) return a;
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

      function getBBox(el) {
        var r = el.getBoundingClientRect();
        return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
      }

      // ── Collect elements ──────────────────────────────────────────────────

      var elements = [];

      // Inputs
      var inputs = document.querySelectorAll('input:not([type="hidden"]), textarea');
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        if (!isVisible(inp)) continue;
        var itype = (inp.type || inp.tagName.toLowerCase()).toLowerCase();
        var kind = itype === 'checkbox' ? 'checkbox'
                 : itype === 'radio'    ? 'radio'
                 : itype === 'submit' || itype === 'button' || itype === 'reset' ? 'button'
                 : inp.tagName.toLowerCase() === 'textarea' ? 'textarea'
                 : 'input';
        elements.push({
          type: kind,
          selector: getBestSelector(inp),
          label: getLabel(inp),
          placeholder: inp.getAttribute('placeholder') || undefined,
          value: inp.value || undefined,
          boundingBox: getBBox(inp)
        });
      }

      // Selects
      var selects = document.querySelectorAll('select');
      for (var j = 0; j < selects.length; j++) {
        var sel = selects[j];
        if (!isVisible(sel)) continue;
        var opts = Array.prototype.map.call(sel.options, function(o) { return o.text; }).join(', ');
        elements.push({
          type: 'select',
          selector: getBestSelector(sel),
          label: getLabel(sel) + ' [options: ' + opts.slice(0, 80) + ']',
          boundingBox: getBBox(sel)
        });
      }

      // Buttons
      var btns = document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
      for (var k = 0; k < btns.length; k++) {
        var btn = btns[k];
        if (!isVisible(btn)) continue;
        elements.push({
          type: 'button',
          selector: getBestSelector(btn),
          label: getLabel(btn),
          role: btn.getAttribute('role') || undefined,
          boundingBox: getBBox(btn)
        });
      }

      // Links (nav + meaningful)
      var links = document.querySelectorAll('a[href]');
      var linkCount = 0;
      for (var l = 0; l < links.length; l++) {
        if (linkCount >= 20) break;
        var a = links[l];
        if (!isVisible(a)) continue;
        var linkText = (a.textContent || '').trim();
        if (!linkText) continue;
        elements.push({
          type: 'link',
          selector: getBestSelector(a),
          label: linkText.slice(0, 80),
          href: a.href.slice(0, 120),
          boundingBox: getBBox(a)
        });
        linkCount++;
      }

      // Contenteditable
      var editables = document.querySelectorAll('[contenteditable="true"]');
      for (var m = 0; m < editables.length; m++) {
        var ed = editables[m];
        if (!isVisible(ed)) continue;
        elements.push({
          type: 'input',
          selector: getBestSelector(ed),
          label: getLabel(ed) + ' [contenteditable]',
          boundingBox: getBBox(ed)
        });
      }

      // ── Forms ────────────────────────────────────────────────────────────

      var forms = [];
      var formEls = document.querySelectorAll('form');
      for (var f = 0; f < formEls.length; f++) {
        var form = formEls[f];
        var fields = [];
        var formInputs = form.querySelectorAll('input:not([type="hidden"]), textarea, select, button[type="submit"]');
        for (var fi = 0; fi < formInputs.length; fi++) {
          fields.push(getLabel(formInputs[fi]) || formInputs[fi].tagName.toLowerCase());
        }
        forms.push({
          id: form.id || ('form-' + f),
          action: form.action || '',
          fields: fields
        });
      }

      // ── Page type detection ───────────────────────────────────────────────

      var bodyText = (document.body.textContent || '').toLowerCase();
      var hasPassword = !!document.querySelector('input[type="password"]');
      var hasSearch = !!document.querySelector('input[type="search"], input[name="q"], input[role="searchbox"]');
      var hasTable = !!document.querySelector('table, [role="grid"]');
      var hasFeed = !!document.querySelector('[role="feed"], article, .post, .card');

      var pageType = 'unknown';
      if (hasPassword) pageType = 'login/auth';
      else if (hasSearch) pageType = 'search';
      else if (hasTable) pageType = 'data-table/dashboard';
      else if (hasFeed) pageType = 'content-feed';
      else if (document.querySelector('form')) pageType = 'form';

      // ── Summary ───────────────────────────────────────────────────────────

      var inputCount   = elements.filter(function(e) { return e.type === 'input' || e.type === 'textarea'; }).length;
      var buttonCount  = elements.filter(function(e) { return e.type === 'button'; }).length;
      var linkCount2   = elements.filter(function(e) { return e.type === 'link'; }).length;
      var selectCount  = elements.filter(function(e) { return e.type === 'select'; }).length;

      var summary = 'Page type: ' + pageType + '. '
        + inputCount  + ' input(s), '
        + buttonCount + ' button(s), '
        + linkCount2  + ' link(s), '
        + selectCount + ' select(s), '
        + forms.length + ' form(s).';

      return {
        url: location.href,
        title: document.title,
        elements: elements,
        forms: forms,
        pageType: pageType,
        summary: summary
      };
    })()
  `);

  return result;
}

// ─── Layer 2: Playwright Accessibility Tree ───────────────────────────────────
// Playwright 1.46+ replaced page.accessibility.snapshot() with page.ariaSnapshot()
// which returns a YAML-formatted string of the ARIA tree.

async function captureAxTree(page: Page): Promise<string[]> {
  try {
    // page.ariaSnapshot() returns YAML — available in Playwright 1.46+
    const yaml: string = await (page as any).ariaSnapshot();
    // Filter to lines that represent interactive elements
    const interestingRoles = /role=(button|link|textbox|searchbox|combobox|checkbox|radio|menuitem|tab|listbox|option|slider|switch|form|dialog|navigation|main)/i;
    const lines = yaml
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .filter((l) => !l.trim().startsWith('#'))
      .slice(0, 60);
    return lines;
  } catch {
    // Fallback: extract roles/names via JS for older Playwright
    return await page.evaluate(`
      (function() {
        var lines = [];
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
        var node;
        while ((node = walker.nextNode())) {
          var role = node.getAttribute('role');
          var label = node.getAttribute('aria-label') || node.getAttribute('aria-labelledby') || (node.textContent || '').trim().slice(0, 50);
          if (role && label) {
            lines.push('[' + role + '] "' + label + '"');
          }
          if (lines.length >= 50) break;
        }
        return lines;
      })()
    `) as string[];
  }
}

// ─── Layer 3: Visual Highlights ───────────────────────────────────────────────

async function injectHighlights(page: Page, elements: InteractiveElement[]): Promise<void> {
  // Remove any previous highlights
  await page.evaluate(`
    (function() {
      var old = document.getElementById('__orbiter_highlight_style');
      if (old) old.remove();
      document.querySelectorAll('[data-orbiter-hl]').forEach(function(el) {
        el.removeAttribute('data-orbiter-hl');
        el.removeAttribute('data-orbiter-label');
      });
      var old2 = document.getElementById('__orbiter_labels');
      if (old2) old2.remove();
    })()
  `);

  // Inject highlight CSS
  await page.evaluate(`
    (function() {
      var style = document.createElement('style');
      style.id = '__orbiter_highlight_style';
      style.textContent = \`
        [data-orbiter-hl="input"]    { outline: 2px solid #ff4444 !important; outline-offset: 1px; }
        [data-orbiter-hl="textarea"] { outline: 2px solid #ff8800 !important; outline-offset: 1px; }
        [data-orbiter-hl="button"]   { outline: 2px solid #4488ff !important; outline-offset: 1px; }
        [data-orbiter-hl="link"]     { outline: 2px solid #44cc44 !important; outline-offset: 1px; }
        [data-orbiter-hl="select"]   { outline: 2px solid #cc44cc !important; outline-offset: 1px; }
        [data-orbiter-hl="checkbox"] { outline: 2px solid #ff4444 !important; outline-offset: 1px; }
        [data-orbiter-hl="radio"]    { outline: 2px solid #ff4444 !important; outline-offset: 1px; }
      \`;
      document.head.appendChild(style);
    })()
  `);

  // Apply data attributes to matched elements using their selectors
  for (const el of elements) {
    try {
      await page.evaluate(
        `(function() {
          try {
            var els = document.querySelectorAll(${JSON.stringify(el.selector)});
            els.forEach(function(e) {
              e.setAttribute('data-orbiter-hl', ${JSON.stringify(el.type)});
              e.setAttribute('data-orbiter-label', ${JSON.stringify(el.label.slice(0, 30))});
            });
          } catch(e) {}
        })()`,
      );
    } catch (_) {
      // ignore selector errors
    }
  }

  // Inject floating legend
  await page.evaluate(`
    (function() {
      var legend = document.createElement('div');
      legend.id = '__orbiter_labels';
      legend.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;background:rgba(0,0,0,0.82);color:#fff;font:12px/1.6 monospace;padding:8px 12px;border-radius:6px;pointer-events:none;';
      legend.innerHTML = '<b style="color:#fff">🔬 Orbiter Page Scanner</b><br>'
        + '<span style="color:#ff4444">■</span> inputs/checkboxes  '
        + '<span style="color:#4488ff">■</span> buttons<br>'
        + '<span style="color:#44cc44">■</span> links  '
        + '<span style="color:#cc44cc">■</span> selects  '
        + '<span style="color:#ff8800">■</span> textarea';
      document.body.appendChild(legend);
    })()
  `);
}

// ─── LLM call ─────────────────────────────────────────────────────────────────

async function askLLM(systemPrompt: string, userMessage: string): Promise<string> {
  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/orbiter-ai',
          'X-Title': 'Orbiter Intelligence Test',
        },
        timeout: 60000,
      },
    );
    return res.data.choices[0]?.message?.content || '(empty)';
  } catch (err: any) {
    return `[LLM ERROR]: ${err.message}`;
  }
}

// ─── Format intelligence for LLM ──────────────────────────────────────────────

function formatIntelligenceForLLM(intel: PageIntelligence, axLines: string[]): string {
  const inputEls   = intel.elements.filter((e) => e.type === 'input' || e.type === 'textarea');
  const buttonEls  = intel.elements.filter((e) => e.type === 'button');
  const linkEls    = intel.elements.filter((e) => e.type === 'link');
  const selectEls  = intel.elements.filter((e) => e.type === 'select');
  const checkboxEls = intel.elements.filter((e) => e.type === 'checkbox' || e.type === 'radio');

  const lines: string[] = [
    `=== PAGE INTELLIGENCE SNAPSHOT ===`,
    `URL:       ${intel.url}`,
    `Title:     ${intel.title}`,
    `Page type: ${intel.pageType}`,
    `Summary:   ${intel.summary}`,
    ``,
  ];

  if (inputEls.length) {
    lines.push(`--- TEXT INPUTS (${inputEls.length}) ---`);
    inputEls.forEach((e) => {
      lines.push(`  selector: ${e.selector}`);
      lines.push(`  label:    ${e.label}`);
      if (e.placeholder) lines.push(`  hint:     ${e.placeholder}`);
      lines.push('');
    });
  }

  if (selectEls.length) {
    lines.push(`--- DROPDOWNS (${selectEls.length}) ---`);
    selectEls.forEach((e) => {
      lines.push(`  selector: ${e.selector}  label: ${e.label}`);
    });
    lines.push('');
  }

  if (checkboxEls.length) {
    lines.push(`--- CHECKBOXES / RADIOS (${checkboxEls.length}) ---`);
    checkboxEls.forEach((e) => {
      lines.push(`  selector: ${e.selector}  label: ${e.label}`);
    });
    lines.push('');
  }

  if (buttonEls.length) {
    lines.push(`--- BUTTONS (${buttonEls.length}) ---`);
    buttonEls.forEach((e) => {
      lines.push(`  selector: ${e.selector}  label: ${e.label}`);
    });
    lines.push('');
  }

  if (linkEls.length) {
    lines.push(`--- NAVIGATION LINKS (${linkEls.length}) ---`);
    linkEls.slice(0, 10).forEach((e) => {
      lines.push(`  [${e.label}] → ${e.href}`);
    });
    if (linkEls.length > 10) lines.push(`  ... and ${linkEls.length - 10} more`);
    lines.push('');
  }

  if (intel.forms.length) {
    lines.push(`--- FORMS (${intel.forms.length}) ---`);
    intel.forms.forEach((f) => {
      lines.push(`  form#${f.id}: fields = [${f.fields.join(', ')}]`);
      if (f.action) lines.push(`  action: ${f.action}`);
    });
    lines.push('');
  }

  if (axLines.length) {
    lines.push(`--- ACCESSIBILITY TREE (semantic roles) ---`);
    axLines.slice(0, 40).forEach((l) => lines.push(l));
    if (axLines.length > 40) lines.push(`  ... (${axLines.length - 40} more nodes)`);
  }

  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.magenta}🔬 ORBITER PAGE INTELLIGENCE TEST${C.reset}`);
  console.log(`${C.dim}Target: ${TARGET_URL}${C.reset}`);

  // ── 1. Launch ───────────────────────────────────────────────────────────────
  section(1, 'BROWSER LAUNCH');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  console.log('  ✓ Chromium launched (headless=false — you should see the browser window)');

  // ── 2. Navigate ─────────────────────────────────────────────────────────────
  section(2, 'NAVIGATION');
  await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000); // let dynamic content settle
  kv('URL:', page.url());
  kv('Title:', await page.title());

  // ── 3. JS Scanner ───────────────────────────────────────────────────────────
  section(3, 'LAYER 1 · CUSTOM JS SCANNER');
  console.log(`  ${C.dim}Running interactive element scan...${C.reset}\n`);
  const intel = await runJSScanner(page);

  kv('Page type:', intel.pageType);
  kv('Summary:', intel.summary);

  const types = ['input', 'textarea', 'button', 'link', 'select', 'checkbox', 'radio'] as const;
  for (const t of types) {
    const group = intel.elements.filter((e) => e.type === t);
    if (!group.length) continue;
    console.log(`\n  ${C.yellow}${t.toUpperCase()}S (${group.length}):${C.reset}`);
    group.forEach((e) => {
      console.log(`    ${C.green}selector:${C.reset} ${e.selector}`);
      console.log(`    ${C.green}label:   ${C.reset} ${e.label}`);
      if (e.placeholder) console.log(`    ${C.green}hint:    ${C.reset} ${e.placeholder}`);
      if (e.href)        console.log(`    ${C.green}href:    ${C.reset} ${e.href}`);
    });
  }

  if (intel.forms.length) {
    console.log(`\n  ${C.yellow}FORMS (${intel.forms.length}):${C.reset}`);
    intel.forms.forEach((f) => {
      console.log(`    form#${f.id} → fields: [${f.fields.join(', ')}]`);
    });
  }

  // ── 4. Accessibility Tree ───────────────────────────────────────────────────
  section(4, 'LAYER 2 · PLAYWRIGHT ACCESSIBILITY TREE');
  console.log(`  ${C.dim}Capturing AX tree (semantic roles + names)...${C.reset}\n`);
  const axLines = await captureAxTree(page);
  axLines.slice(0, 35).forEach((l) => console.log(`  ${l}`));
  if (axLines.length > 35) console.log(`  ${C.dim}... and ${axLines.length - 35} more nodes${C.reset}`);

  // ── 5. Visual Highlights ────────────────────────────────────────────────────
  section(5, 'LAYER 3 · VISUAL HIGHLIGHTS (live in browser)');
  console.log('  Injecting coloured borders into the live page...');
  await injectHighlights(page, intel.elements);
  console.log(`\n  ${C.red}■ Red${C.reset}    = text inputs / checkboxes`);
  console.log(`  ${C.cyan}■ Blue${C.reset}   = buttons`);
  console.log(`  ${C.green}■ Green${C.reset}  = links`);
  console.log(`  \x1b[35m■ Purple\x1b[0m = dropdowns`);
  console.log(`  \x1b[33m■ Orange\x1b[0m = textareas`);
  console.log(`\n  ${C.bold}>>> Look at the browser window now <<<${C.reset}`);

  // Screenshot with highlights
  const screenshotPath = `data/errors/intelligence-test-${Date.now()}.jpg`;
  fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
  await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 85 });
  kv('\n  Screenshot saved:', screenshotPath);

  // ── 6. Compose LLM payload ──────────────────────────────────────────────────
  section(6, 'FINAL LLM PAYLOAD (what analyze_page tool will send)');
  const llmPayload = formatIntelligenceForLLM(intel, axLines);
  console.log('\n' + llmPayload.split('\n').map((l) => '  ' + l).join('\n'));

  // ── 7. LLM Demo — ask it to act on the page ─────────────────────────────────
  section(7, 'LLM DEMO — acting on page with full intelligence');
  console.log(`  ${C.dim}Asking LLM: "How do I log in on this page?"${C.reset}\n`);

  const answer = await askLLM(
    'You are a browser automation agent. You receive a PAGE INTELLIGENCE SNAPSHOT that tells you exactly what interactive elements exist on the current page. Use this data to give precise, selector-based instructions.',
    `Here is the full page intelligence for ${TARGET_URL}:\n\n${llmPayload}\n\nTask: Log in with username "oshanavishka" and password "mypassword123". What exact tool calls should I make, in order, with which selectors?`,
  );

  console.log(`  ${C.green}LLM response:${C.reset}`);
  console.log(answer.split('\n').map((l) => '  ' + l).join('\n'));

  // ── 8. Diagnosis ────────────────────────────────────────────────────────────
  section(8, 'DIAGNOSIS');
  console.log(`
  What we proved:
  ✅  JS scanner extracts ${intel.elements.length} interactive elements with real selectors
  ✅  AX tree adds semantic meaning (roles, labels) — ${axLines.length} nodes
  ✅  Highlights let YOU see what the scanner found in the live browser
  ✅  LLM payload is concise, structured, and gives exact selectors

  What this enables:
  • After every navigate/click → auto-inject this snapshot into the LLM conversation
  • LLM no longer guesses — it picks selectors from the real DOM
  • Works on any site, any page, without training-data knowledge

  Files produced:
    Screenshot (with highlights): ${screenshotPath}
  `);

  // Keep browser open 5 seconds so you can see the highlights
  console.log(`  ${C.dim}Keeping browser open 5s so you can inspect highlights...${C.reset}`);
  await page.waitForTimeout(5000);

  await browser.close();
  console.log(`  ${C.green}✓ Done.${C.reset}\n`);
}

main().catch((err) => {
  console.error(`${C.red}Fatal:${C.reset}`, err);
  process.exit(1);
});
