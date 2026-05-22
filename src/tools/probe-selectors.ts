import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';
import { logger } from '../cli/ui/logger.js';

// Run inside the browser — passed as a string to avoid tsx __name() injection
const PROBE_SCRIPT = `
(function(itemSelector, schema) {
  // ── Find items ────────────────────────────────────────────────────────────
  var items = document.querySelectorAll(itemSelector);
  if (items.length === 0) {
    return { error: 'No items found for selector: ' + itemSelector, itemCount: 0 };
  }

  var firstItem = items[0];

  // ── DOM discovery: walk the first item and collect elements ───────────────
  var discovery = [];
  function walk(el, depth, path) {
    if (depth > 4) return;
    var tag = el.tagName.toLowerCase();
    var id   = el.id ? '#' + el.id : '';
    var cls  = Array.prototype.slice.call(el.classList)
               .filter(function(c) { return c.length < 40; })
               .slice(0, 3).join('.');
    var sel  = path + (path ? ' > ' : '') + tag + (id || (cls ? '.' + cls : ''));

    var text      = (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
    var href      = el.getAttribute('href') || undefined;
    var ariaLabel = el.getAttribute('aria-label') || undefined;
    var src       = el.getAttribute('src') || undefined;
    var dataAsin  = el.getAttribute('data-asin') || undefined;

    if (text || href || ariaLabel) {
      discovery.push({
        sel: sel,
        tag: tag,
        text: text || undefined,
        href: href,
        ariaLabel: ariaLabel,
        src: src,
        dataAsin: dataAsin
      });
    }

    var children = el.children;
    for (var i = 0; i < Math.min(children.length, 8); i++) {
      walk(children[i], depth + 1, sel);
    }
  }
  walk(firstItem, 0, '');

  // ── Probe each field in the schema ────────────────────────────────────────
  function extractField(el, rule) {
    if (typeof rule === 'string') {
      var found = el.querySelector(rule);
      return {
        selector: rule,
        method: 'text',
        element: found ? found.tagName.toLowerCase() : null,
        value: found ? (found.textContent || '').trim().replace(/\\s+/g, ' ') : null
      };
    }
    // Object rule: { selector, method, attribute }
    var found2 = el.querySelector(rule.selector);
    if (!found2) return { selector: rule.selector, method: rule.method || 'text', element: null, value: null };
    var val;
    if (rule.method === 'attribute') {
      val = found2.getAttribute(rule.attribute || 'href') || null;
    } else {
      val = (found2.textContent || '').trim().replace(/\\s+/g, ' ') || null;
    }
    return { selector: rule.selector, method: rule.method || 'text', element: found2.tagName.toLowerCase(), value: val };
  }

  var probeResults = {};
  var missingFields = [];
  var foundFields   = [];

  var schemaKeys = Object.keys(schema);
  for (var i = 0; i < schemaKeys.length; i++) {
    var field  = schemaKeys[i];
    var result = extractField(firstItem, schema[field]);
    probeResults[field] = result;
    if (result.value && result.value !== '') {
      foundFields.push(field + ' = "' + result.value.slice(0, 60) + '"');
    } else {
      missingFields.push(field);
    }
  }

  // ── Suggestions: find likely selectors for missing fields ─────────────────
  var suggestions = {};
  for (var m = 0; m < missingFields.length; m++) {
    var mf = missingFields[m];
    var candidates = [];

    // Heuristic matches
    var hints = {
      title:   ['h1','h2','h3','h4','.title','.name','[class*="title"]','[class*="name"]'],
      name:    ['h1','h2','h3','.name','[class*="name"]'],
      price:   ['.price','[class*="price"]','[class*="cost"]','[data-price]','[aria-label*="price"]'],
      rating:  ['[class*="star"]','[aria-label*="stars"]','[class*="rating"]'],
      url:     ['a[href]'],
      href:    ['a[href]'],
      link:    ['a[href]'],
      image:   ['img[src]'],
      img:     ['img[src]'],
      description: ['p','[class*="desc"]','[class*="summary"]'],
    };

    var hintList = hints[mf.toLowerCase()] || [];
    for (var h = 0; h < hintList.length; h++) {
      var candidate = firstItem.querySelector(hintList[h]);
      if (candidate) {
        var cval;
        if (hintList[h] === 'a[href]') {
          cval = candidate.getAttribute('href');
          candidates.push({ selector: hintList[h], attribute: 'href', value: cval });
        } else if (hintList[h] === 'img[src]') {
          cval = candidate.getAttribute('src');
          candidates.push({ selector: hintList[h], attribute: 'src', value: cval });
        } else {
          cval = (candidate.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
          if (cval) candidates.push({ selector: hintList[h], value: cval });
        }
        if (candidates.length >= 3) break;
      }
    }

    // Also check aria-label matches in discovery
    for (var d = 0; d < discovery.length; d++) {
      if (discovery[d].ariaLabel && mf.toLowerCase() === 'rating') {
        candidates.push({ selector: '[aria-label*="stars"]', attribute: 'aria-label', value: discovery[d].ariaLabel });
        break;
      }
    }

    if (candidates.length > 0) suggestions[mf] = candidates;
  }

  return {
    itemCount: items.length,
    probeResults: probeResults,
    foundFields: foundFields,
    missingFields: missingFields,
    suggestions: suggestions,
    domDiscovery: discovery.slice(0, 40)
  };
})(ITEM_SELECTOR, SCHEMA)
`;

export const probeSelectorsTool: ToolDefinition = {
  name: 'probe_selectors',

  description: `
Test your extraction schema on the FIRST matching item BEFORE running detect_repetitive_pattern.

ALWAYS call this before detect_repetitive_pattern to verify selectors return real data.
Never trust guessed selectors — they are often wrong on complex sites like Amazon, LinkedIn, etc.

RETURNS:
- probeResults: actual values extracted by each field selector (null = selector is wrong)
- missingFields: list of fields that returned null
- suggestions: candidate selectors for missing fields, discovered from the real DOM
- domDiscovery: actual elements inside the first item (use this to find correct selectors)

WORKFLOW (mandatory before detect_repetitive_pattern):
  1. Call probe_selectors with your initial schema
  2. Check missingFields — if any exist, your schema is incomplete
  3. Read suggestions and domDiscovery to find correct selectors
  4. Call probe_selectors again with the corrected schema
  5. Repeat until missingFields is empty and all probeResults have real values
  6. ONLY THEN call detect_repetitive_pattern with the verified schema
`.trim(),

  parameters: {
    type: 'object',
    properties: {
      itemSelector: {
        type: 'string',
        description: 'CSS selector that matches each repeating item on the page',
      },
      extractSchema: {
        type: 'object',
        description: `
Schema mapping field names to selectors — same format as detect_repetitive_pattern.
Simple string: { "title": "h2 span" }
With attribute: { "url": { "selector": "a", "method": "attribute", "attribute": "href" } }
        `.trim(),
      },
    },
    required: ['itemSelector', 'extractSchema'],
  },

  execute: async (
    params: { itemSelector: string; extractSchema: Record<string, any> },
    context: ExecutionContext,
  ): Promise<ToolResult> => {
    const { itemSelector, extractSchema } = params;

    try {
      const page = context.getBrowserManager().getPage();

      logger.bullet(`Probing selectors on first item of "${itemSelector}"...`);

      // Inject schema as JSON into the script string
      const script = PROBE_SCRIPT
        .replace('ITEM_SELECTOR', JSON.stringify(itemSelector))
        .replace('SCHEMA', JSON.stringify(extractSchema));

      const raw: any = await page.evaluate(script);

      if (raw.error) {
        return {
          success: false,
          error: raw.error,
        };
      }

      const { itemCount, probeResults, foundFields, missingFields, suggestions, domDiscovery } = raw;

      // Build a readable summary for the LLM
      const lines: string[] = [
        `=== PROBE RESULTS ===`,
        `Items found on page: ${itemCount}`,
        ``,
        `FIELD RESULTS (from first item):`,
      ];

      for (const [field, result] of Object.entries(probeResults as Record<string, any>)) {
        const status = result.value ? '✓' : '✗';
        const val    = result.value ? `"${String(result.value).slice(0, 80)}"` : 'null — SELECTOR WRONG';
        lines.push(`  ${status} ${field.padEnd(12)} selector: ${result.selector}  →  ${val}`);
      }

      if (missingFields.length > 0) {
        lines.push(``);
        lines.push(`MISSING FIELDS (${missingFields.length}): ${missingFields.join(', ')}`);
        lines.push(`You MUST fix these before calling detect_repetitive_pattern.`);
      }

      if (Object.keys(suggestions).length > 0) {
        lines.push(``);
        lines.push(`SUGGESTED SELECTORS FOR MISSING FIELDS:`);
        for (const [field, candidates] of Object.entries(suggestions as Record<string, any[]>)) {
          lines.push(`  ${field}:`);
          candidates.forEach((c: any) => {
            const v = c.value ? `→ "${String(c.value).slice(0, 60)}"` : '';
            const attr = c.attribute ? ` [attribute: ${c.attribute}]` : '';
            lines.push(`    • ${c.selector}${attr} ${v}`);
          });
        }
      }

      lines.push(``);
      lines.push(`DOM DISCOVERY (elements inside first item):`);
      (domDiscovery as any[]).slice(0, 25).forEach((el: any) => {
        const extras: string[] = [];
        if (el.href)      extras.push(`href="${el.href.slice(0, 60)}"`);
        if (el.ariaLabel) extras.push(`aria-label="${el.ariaLabel.slice(0, 60)}"`);
        if (el.text)      extras.push(`text="${el.text.slice(0, 60)}"`);
        lines.push(`  <${el.tag}> ${el.sel}  ${extras.join('  ')}`);
      });

      const allFound = missingFields.length === 0;

      if (allFound) {
        logger.success(`All ${foundFields.length} fields verified with real data`);
      } else {
        logger.warn(`${missingFields.length} field(s) missing: ${missingFields.join(', ')}`);
      }

      return {
        success: true,
        message: allFound
          ? `All fields verified: ${foundFields.join(', ')}`
          : `Schema incomplete — ${missingFields.length} field(s) returned null: ${missingFields.join(', ')}. Read suggestions and fix before extracting.`,
        data: lines.join('\n'),
      };
    } catch (error) {
      logger.error(`probe_selectors failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  },
};
