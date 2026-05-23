import { ToolDefinition, ToolResult } from './types.js';
import { ExecutionContext } from '../core/execution-context.js';

// ─── Monitoring script injected into the page ─────────────────────────���───────
// Captures console logs, network requests, and JS errors in window.__orbiterDevTools.
// Uses var/function for maximum page compatibility.
const MONITOR_SCRIPT = `(function() {
  if (window.__orbiterDevTools) return 'already_injected';

  window.__orbiterDevTools = {
    consoleLogs: [],
    networkRequests: [],
    jsErrors: [],
    injectedAt: Date.now()
  };

  var dt = window.__orbiterDevTools;

  // ── Console interception ──────────────────────────────
  var LEVELS = ['log', 'warn', 'error', 'info', 'debug'];
  var _origConsole = {};
  LEVELS.forEach(function(m) {
    _origConsole[m] = console[m];
    console[m] = function() {
      var args = Array.prototype.slice.call(arguments);
      dt.consoleLogs.push({
        level: m,
        message: args.map(function(a) {
          try { return typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a); }
          catch(e) { return '[unserializable]'; }
        }).join(' '),
        timestamp: Date.now()
      });
      if (dt.consoleLogs.length > 500) dt.consoleLogs.splice(0, 100);
      return _origConsole[m].apply(console, arguments);
    };
  });

  // ── JS error interception ─────────────────────────────
  window.addEventListener('error', function(e) {
    dt.jsErrors.push({
      type: 'uncaught',
      message: e.message || 'Unknown error',
      source: e.filename || '',
      line: e.lineno || 0,
      col: e.colno || 0,
      timestamp: Date.now()
    });
  });

  window.addEventListener('unhandledrejection', function(e) {
    var msg;
    try { msg = e.reason && e.reason.message ? e.reason.message : String(e.reason); }
    catch(ex) { msg = 'Unknown rejection'; }
    dt.jsErrors.push({ type: 'unhandledRejection', message: msg, timestamp: Date.now() });
  });

  // ── Fetch interception ────────────────────────────────
  var _origFetch = window.fetch;
  if (_origFetch) {
    window.fetch = function(input, init) {
      var url = typeof input === 'string' ? input
        : (input && input.url ? input.url : String(input));
      var method = ((init && init.method) ? init.method : 'GET').toUpperCase();
      var start = Date.now();
      var id = Math.random().toString(36).slice(2, 9);
      var entry = { id: id, url: url, method: method, type: 'fetch',
                    status: null, duration: null, error: null, startTime: start };
      dt.networkRequests.push(entry);
      if (dt.networkRequests.length > 300) dt.networkRequests.splice(0, 100);
      return _origFetch.apply(this, arguments).then(function(res) {
        entry.status = res.status;
        entry.duration = Date.now() - start;
        return res;
      }, function(err) {
        entry.error = String(err);
        entry.duration = Date.now() - start;
        throw err;
      });
    };
  }

  // ── XHR interception ─────────────────────────────────
  var _OrigXHR = window.XMLHttpRequest;
  if (_OrigXHR) {
    window.XMLHttpRequest = function() {
      var xhr = new _OrigXHR();
      var id = Math.random().toString(36).slice(2, 9);
      var entry = { id: id, url: '', method: 'GET', type: 'xhr',
                    status: null, duration: null, error: null, startTime: 0 };
      dt.networkRequests.push(entry);
      if (dt.networkRequests.length > 300) dt.networkRequests.splice(0, 100);
      var _open = xhr.open;
      xhr.open = function(m, u) {
        entry.method = (m || 'GET').toUpperCase();
        entry.url = String(u || '');
        return _open.apply(xhr, arguments);
      };
      var _send = xhr.send;
      xhr.send = function() {
        entry.startTime = Date.now();
        xhr.addEventListener('loadend', function() {
          entry.status = xhr.status || 0;
          entry.duration = Date.now() - entry.startTime;
          if (!xhr.status) entry.error = 'Network error or aborted';
        });
        return _send.apply(xhr, arguments);
      };
      return xhr;
    };
  }

  return 'injected';
})()`;

// ─��─ Helper ───────────────────────────────────────────────────────────────────

function isInjected(data: any): boolean {
  return data !== null && data !== undefined && data !== 'not_injected';
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const devtoolsInjectTool: ToolDefinition = {
  name: 'devtools_inject',
  description:
    'Inject the DevTools monitor into the current page. ' +
    'Must be called once after navigating to a page before using other devtools_* tools. ' +
    'Safe to call multiple times — skips if already injected. ' +
    'Re-inject after a full page navigation (not needed for SPA route changes).',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async (_params, context: ExecutionContext): Promise<ToolResult> => {
    const mcpClient = context.getMcpClient();
    const result = await mcpClient.evaluate(MONITOR_SCRIPT);
    const status = String(result);
    const msg = status === 'already_injected'
      ? 'DevTools monitor already active on this page'
      : 'DevTools monitor injected — console, network, and error capture active';
    return { success: true, message: msg, data: { status } };
  },
};

export const devtoolsConsoleTool: ToolDefinition = {
  name: 'devtools_console',
  description:
    'Read captured browser console logs (log, warn, error, info, debug). ' +
    'Requires devtools_inject to have been called first. ' +
    'Use this to find JS console errors, warnings, or debug output from the page.',
  parameters: {
    type: 'object',
    properties: {
      level: {
        type: 'string',
        enum: ['all', 'log', 'info', 'warn', 'error', 'debug'],
        description: 'Filter by log level. Defaults to "all".',
      },
      limit: {
        type: 'number',
        description: 'Max number of entries to return. Defaults to 50.',
      },
      since: {
        type: 'number',
        description: 'Only return entries after this Unix timestamp (ms).',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { level = 'all', limit = 50, since } = params as {
      level?: string;
      limit?: number;
      since?: number;
    };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var dt = window.__orbiterDevTools;
      if (!dt) return null;
      var logs = dt.consoleLogs.slice();
      ${level !== 'all' ? `logs = logs.filter(function(l) { return l.level === ${JSON.stringify(level)}; });` : ''}
      ${since ? `logs = logs.filter(function(l) { return l.timestamp >= ${since}; });` : ''}
      return logs.slice(-${Math.min(Number(limit) || 50, 200)});
    })()`);

    if (!isInjected(data)) {
      return { success: false, error: 'DevTools not injected. Call devtools_inject first.' };
    }

    const logs: any[] = Array.isArray(data) ? data : [];
    const errors = logs.filter((l) => l.level === 'error').length;
    const warns = logs.filter((l) => l.level === 'warn').length;

    return {
      success: true,
      data: logs,
      message: `${logs.length} log entries (${errors} errors, ${warns} warnings)`,
    };
  },
};

export const devtoolsNetworkTool: ToolDefinition = {
  name: 'devtools_network',
  description:
    'Read captured network requests (fetch and XHR). ' +
    'Requires devtools_inject to have been called first. ' +
    'Use this to find failed API calls, slow requests, or unexpected network traffic.',
  parameters: {
    type: 'object',
    properties: {
      filter: {
        type: 'string',
        enum: ['all', 'failed', 'success', 'pending'],
        description: 'Filter requests. "failed" = error or status >= 400. Defaults to "all".',
      },
      url_contains: {
        type: 'string',
        description: 'Only return requests whose URL contains this string.',
      },
      limit: {
        type: 'number',
        description: 'Max entries to return. Defaults to 50.',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { filter = 'all', url_contains, limit = 50 } = params as {
      filter?: string;
      url_contains?: string;
      limit?: number;
    };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var dt = window.__orbiterDevTools;
      if (!dt) return null;
      var reqs = dt.networkRequests.slice();
      ${filter === 'failed' ? `reqs = reqs.filter(function(r) { return r.error || (r.status && r.status >= 400); });` : ''}
      ${filter === 'success' ? `reqs = reqs.filter(function(r) { return r.status && r.status < 400 && !r.error; });` : ''}
      ${filter === 'pending' ? `reqs = reqs.filter(function(r) { return r.status === null && !r.error; });` : ''}
      ${url_contains ? `reqs = reqs.filter(function(r) { return r.url && r.url.includes(${JSON.stringify(url_contains)}); });` : ''}
      return reqs.slice(-${Math.min(Number(limit) || 50, 200)});
    })()`);

    if (!isInjected(data)) {
      return { success: false, error: 'DevTools not injected. Call devtools_inject first.' };
    }

    const reqs: any[] = Array.isArray(data) ? data : [];
    const failed = reqs.filter((r) => r.error || (r.status && r.status >= 400)).length;
    const pending = reqs.filter((r) => r.status === null && !r.error).length;

    return {
      success: true,
      data: reqs,
      message: `${reqs.length} requests (${failed} failed, ${pending} pending)`,
    };
  },
};

export const devtoolsErrorsTool: ToolDefinition = {
  name: 'devtools_errors',
  description:
    'Read captured JavaScript errors and unhandled promise rejections. ' +
    'Requires devtools_inject to have been called first. ' +
    'Use this to find runtime JS crashes on the page.',
  parameters: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max entries to return. Defaults to 50.' },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { limit = 50 } = params as { limit?: number };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var dt = window.__orbiterDevTools;
      if (!dt) return null;
      return dt.jsErrors.slice(-${Math.min(Number(limit) || 50, 100)});
    })()`);

    if (!isInjected(data)) {
      return { success: false, error: 'DevTools not injected. Call devtools_inject first.' };
    }

    const errors: any[] = Array.isArray(data) ? data : [];
    return {
      success: true,
      data: errors,
      message: errors.length === 0 ? 'No JS errors captured' : `${errors.length} JS error(s) captured`,
    };
  },
};

export const devtoolsPerformanceTool: ToolDefinition = {
  name: 'devtools_performance',
  description:
    'Get page performance metrics: load timings, resource counts, slow resources, and JS heap usage. ' +
    'Does NOT require devtools_inject — reads directly from the Performance API.',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async (_params, context: ExecutionContext): Promise<ToolResult> => {
    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var nav = performance.getEntriesByType('navigation')[0];
      var resources = performance.getEntriesByType('resource');

      var byType = {};
      var slowest = [];
      resources.forEach(function(r) {
        var t = r.initiatorType || 'other';
        byType[t] = (byType[t] || 0) + 1;
        if (r.duration > 500) {
          slowest.push({
            url: r.name.length > 120 ? r.name.slice(0, 120) + '…' : r.name,
            duration: Math.round(r.duration) + 'ms',
            size: r.encodedBodySize ? Math.round(r.encodedBodySize / 1024) + 'KB' : 'unknown'
          });
        }
      });
      slowest.sort(function(a, b) { return parseInt(b.duration) - parseInt(a.duration); });

      return {
        url: location.href,
        pageLoad: nav ? {
          ttfb: Math.round(nav.responseStart - nav.startTime) + 'ms',
          domInteractive: Math.round(nav.domInteractive) + 'ms',
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd) + 'ms',
          loadComplete: Math.round(nav.loadEventEnd) + 'ms',
          transferSize: nav.transferSize ? Math.round(nav.transferSize / 1024) + 'KB' : 'unknown'
        } : null,
        resources: {
          total: resources.length,
          byType: byType,
          slowResources: slowest.slice(0, 8)
        },
        memory: (performance.memory) ? {
          usedHeap: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
          totalHeap: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
          heapLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
        } : null
      };
    })()`);

    if (!data) {
      return { success: false, error: 'Performance API not available on this page.' };
    }

    return { success: true, data, message: `Performance metrics for: ${(data as any).url}` };
  },
};

export const devtoolsDomTool: ToolDefinition = {
  name: 'devtools_dom',
  description:
    'Inspect a DOM element: computed styles, ARIA attributes, dimensions, visibility, and text content. ' +
    'Use this for accessibility auditing or to debug styling/layout issues.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the element to inspect.',
      },
    },
    required: ['selector'],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { selector } = params as { selector: string };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;

      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);

      var attrs = {};
      for (var i = 0; i < el.attributes.length; i++) {
        attrs[el.attributes[i].name] = el.attributes[i].value;
      }

      return {
        tagName: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className || null,
        textContent: el.textContent ? el.textContent.trim().slice(0, 300) : null,
        attributes: attrs,
        dimensions: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          bottom: Math.round(rect.bottom),
          right: Math.round(rect.right)
        },
        isVisible: rect.width > 0 && rect.height > 0
          && style.visibility !== 'hidden'
          && style.display !== 'none'
          && style.opacity !== '0',
        computedStyles: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          position: style.position,
          zIndex: style.zIndex,
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          overflow: style.overflow,
          cursor: style.cursor
        },
        aria: {
          role: el.getAttribute('role') || null,
          label: el.getAttribute('aria-label') || null,
          labelledBy: el.getAttribute('aria-labelledby') || null,
          describedBy: el.getAttribute('aria-describedby') || null,
          hidden: el.getAttribute('aria-hidden') || null,
          expanded: el.getAttribute('aria-expanded') || null,
          disabled: el.getAttribute('aria-disabled') || null,
          checked: el.getAttribute('aria-checked') || null,
          live: el.getAttribute('aria-live') || null
        }
      };
    })()`);

    if (!data) {
      return { success: false, error: `No element found for selector: "${selector}"` };
    }

    const el = data as any;
    return {
      success: true,
      data: el,
      message: `<${el.tagName}${el.id ? '#' + el.id : ''}> — ${el.isVisible ? 'visible' : 'hidden'}, ${el.dimensions.width}×${el.dimensions.height}px`,
    };
  },
};

export const devtoolsAccessibilityTool: ToolDefinition = {
  name: 'devtools_accessibility',
  description:
    'Audit the accessibility of a page section or element: find missing labels, ' +
    'poor contrast indicators, interactive elements without roles, and ARIA issues. ' +
    'Pass a selector to audit a specific section, or omit to audit the whole page.',
  parameters: {
    type: 'object',
    properties: {
      selector: {
        type: 'string',
        description: 'CSS selector for the root element to audit. Defaults to "body".',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { selector = 'body' } = params as { selector?: string };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var root = document.querySelector(${JSON.stringify(selector)});
      if (!root) return null;

      var issues = [];
      var stats = { images: 0, inputs: 0, buttons: 0, links: 0, headings: [] };

      // Images without alt
      root.querySelectorAll('img').forEach(function(img) {
        stats.images++;
        if (!img.getAttribute('alt') && img.getAttribute('alt') !== '') {
          issues.push({ type: 'error', element: 'img', issue: 'Missing alt attribute', src: (img.src || '').slice(-60) });
        }
      });

      // Inputs without labels
      root.querySelectorAll('input, select, textarea').forEach(function(el) {
        stats.inputs++;
        var id = el.id;
        var hasLabel = (id && document.querySelector('label[for="' + id + '"]'))
          || el.getAttribute('aria-label')
          || el.getAttribute('aria-labelledby')
          || el.closest('label');
        if (!hasLabel && el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button') {
          issues.push({ type: 'error', element: el.tagName.toLowerCase() + (el.type ? '[type=' + el.type + ']' : ''), issue: 'Input has no associated label', id: el.id || null });
        }
      });

      // Buttons without accessible name
      root.querySelectorAll('button, [role="button"]').forEach(function(el) {
        stats.buttons++;
        var name = el.textContent.trim()
          || el.getAttribute('aria-label')
          || el.getAttribute('aria-labelledby')
          || el.getAttribute('title');
        if (!name) {
          issues.push({ type: 'error', element: 'button', issue: 'Button has no accessible name', class: (el.className || '').slice(0, 60) });
        }
      });

      // Links without accessible name
      root.querySelectorAll('a').forEach(function(el) {
        stats.links++;
        var name = el.textContent.trim()
          || el.getAttribute('aria-label')
          || el.getAttribute('title');
        if (!name) {
          issues.push({ type: 'warn', element: 'a', issue: 'Link has no accessible text', href: (el.href || '').slice(-60) });
        }
      });

      // Heading structure
      root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(function(el) {
        stats.headings.push({ level: parseInt(el.tagName[1]), text: el.textContent.trim().slice(0, 80) });
      });

      // Interactive elements with tabindex=-1 that shouldn't be
      root.querySelectorAll('[tabindex="-1"]').forEach(function(el) {
        var tag = el.tagName.toLowerCase();
        if (tag === 'a' || tag === 'button' || tag === 'input') {
          issues.push({ type: 'warn', element: tag, issue: 'Focusable element has tabindex=-1 (keyboard unreachable)' });
        }
      });

      return {
        selector: ${JSON.stringify(selector)},
        stats: stats,
        issues: issues,
        issueCount: { errors: issues.filter(function(i) { return i.type === 'error'; }).length, warnings: issues.filter(function(i) { return i.type === 'warn'; }).length }
      };
    })()`);

    if (!data) {
      return { success: false, error: `No element found for selector: "${selector}"` };
    }

    const result = data as any;
    const { errors, warnings } = result.issueCount;
    const status = errors > 0 ? `${errors} accessibility errors, ${warnings} warnings` : warnings > 0 ? `${warnings} warnings` : 'No accessibility issues found';

    return { success: true, data: result, message: status };
  },
};

export const devtoolsClearTool: ToolDefinition = {
  name: 'devtools_clear',
  description: 'Clear all captured DevTools data (console logs, network requests, JS errors). Useful to start fresh before a specific user action you want to monitor.',
  parameters: {
    type: 'object',
    properties: {
      what: {
        type: 'string',
        enum: ['all', 'console', 'network', 'errors'],
        description: 'What to clear. Defaults to "all".',
      },
    },
    required: [],
  },
  execute: async (params, context: ExecutionContext): Promise<ToolResult> => {
    const { what = 'all' } = params as { what?: string };

    const mcpClient = context.getMcpClient();
    const data = await mcpClient.evaluate(`(function() {
      var dt = window.__orbiterDevTools;
      if (!dt) return null;
      ${what === 'all' || what === 'console' ? 'dt.consoleLogs = [];' : ''}
      ${what === 'all' || what === 'network' ? 'dt.networkRequests = [];' : ''}
      ${what === 'all' || what === 'errors' ? 'dt.jsErrors = [];' : ''}
      return 'cleared';
    })()`);

    if (!isInjected(data)) {
      return { success: false, error: 'DevTools not injected. Call devtools_inject first.' };
    }

    return { success: true, message: `DevTools data cleared (${what})` };
  },
};

export const allDevTools: ToolDefinition[] = [
  devtoolsInjectTool,
  devtoolsConsoleTool,
  devtoolsNetworkTool,
  devtoolsErrorsTool,
  devtoolsPerformanceTool,
  devtoolsDomTool,
  devtoolsAccessibilityTool,
  devtoolsClearTool,
];
