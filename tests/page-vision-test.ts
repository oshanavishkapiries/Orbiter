/**
 * Page Vision Diagnostic Test
 *
 * Demonstrates the gap between what the LLM currently "sees" after browser
 * actions vs what a rich page snapshot would look like with vision support.
 *
 * Run: npx tsx tests/page-vision-test.ts [url]
 * Default URL: https://www.google.com
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const TARGET_URL = process.argv[2] || 'https://www.google.com';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY!;
const VISION_MODEL = 'google/gemini-2.0-flash-001'; // vision-capable model
const TEXT_MODEL = process.env.DEFAULT_MODEL || 'qwen/qwen3.6-plus';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function section(title: string) {
  const line = '─'.repeat(64);
  console.log(`\n${line}`);
  console.log(`  ${title}`);
  console.log(line);
}

function label(key: string, value: string) {
  console.log(`  \x1b[36m${key.padEnd(22)}\x1b[0m ${value}`);
}

async function callLLM(
  messages: any[],
  model: string,
  label: string,
): Promise<string> {
  try {
    const res = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages,
        max_tokens: 1024,
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/orbiter-ai',
          'X-Title': 'Orbiter Vision Test',
        },
        timeout: 60000,
      },
    );
    return res.data.choices[0]?.message?.content || '(empty response)';
  } catch (err: any) {
    return `[LLM ERROR on ${label}]: ${err.message}`;
  }
}

// ─── DOM Snapshot ─────────────────────────────────────────────────────────────

async function captureDomSnapshot(page: any): Promise<{
  url: string;
  title: string;
  visibleText: string;
  clickableElements: string[];
  inputFields: string[];
  allLinks: { text: string; href: string }[];
  hasModal: boolean;
  hasCaptcha: boolean;
  hasOverlay: boolean;
}> {
  // Use page.evaluate with a string to avoid tsx transpiler injecting __name() calls
  return await page.evaluate(`
    (function() {
      function isVisible(el) {
        var rect = el.getBoundingClientRect();
        var style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 &&
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          style.opacity !== '0';
      }

      // Gather visible text
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var textNodes = [];
      var node;
      while ((node = walker.nextNode())) {
        var text = (node.textContent || '').trim();
        if (text && text.length > 2 && node.parentElement && isVisible(node.parentElement)) {
          textNodes.push(text);
        }
      }
      var seen = {};
      var unique = [];
      textNodes.forEach(function(t) { if (!seen[t]) { seen[t] = true; unique.push(t); } });
      var visibleText = unique.join(' | ').slice(0, 2000);

      // Clickable elements
      var clickableElements = [];
      var clickTargets = document.querySelectorAll('a, button, [role="button"], input[type="submit"]');
      for (var i = 0; i < clickTargets.length; i++) {
        var el = clickTargets[i];
        if (!isVisible(el) || clickableElements.length >= 25) continue;
        var tag = el.tagName.toLowerCase();
        var text = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
        var href = el.href || '';
        var id = el.id ? '#' + el.id : '';
        var testid = el.getAttribute('data-testid') ? '[data-testid="' + el.getAttribute('data-testid') + '"]' : '';
        var sel = tag + (id || testid);
        clickableElements.push(sel + (text ? ' → "' + text + '"' : '') + (href ? ' (' + href.slice(0, 60) + ')' : ''));
      }

      // Input fields
      var inputFields = [];
      var inputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
      for (var j = 0; j < inputs.length; j++) {
        var inp = inputs[j];
        if (!isVisible(inp) || inputFields.length >= 15) continue;
        var type = inp.type || inp.tagName.toLowerCase();
        var name = inp.getAttribute('name') || inp.id || '';
        var placeholder = inp.getAttribute('placeholder') || '';
        var ariaLabel = inp.getAttribute('aria-label') || '';
        inputFields.push('[' + type + ']' + (name ? ' name="' + name + '"' : '') + (ariaLabel ? ' aria-label="' + ariaLabel + '"' : '') + (placeholder ? ' placeholder="' + placeholder + '"' : ''));
      }

      // Links
      var allLinks = [];
      var anchors = document.querySelectorAll('a[href]');
      for (var k = 0; k < anchors.length; k++) {
        var a = anchors[k];
        if (!isVisible(a) || allLinks.length >= 30) continue;
        var linkText = (a.textContent || '').trim().slice(0, 80);
        var linkHref = (a.href || '').slice(0, 120);
        if (linkHref && linkText) allLinks.push({ text: linkText, href: linkHref });
      }

      return {
        url: location.href,
        title: document.title,
        visibleText: visibleText,
        clickableElements: clickableElements,
        inputFields: inputFields,
        allLinks: allLinks,
        hasModal: !!(document.querySelector('[role="dialog"]') || document.querySelector('.modal.show')),
        hasCaptcha: !!(document.querySelector('[class*="captcha"]') || document.querySelector('[id*="captcha"]') || document.querySelector('iframe[src*="recaptcha"]')),
        hasOverlay: !!(document.querySelector('[class*="overlay"]') || document.querySelector('[class*="cookie"]') || document.querySelector('[class*="consent"]'))
      };
    })()
  `);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n\x1b[1m\x1b[35m🔬 ORBITER PAGE VISION DIAGNOSTIC TEST\x1b[0m');
  console.log(`\x1b[90mTarget URL: ${TARGET_URL}\x1b[0m`);

  // ── 1. Launch browser ──────────────────────────────────────────────────────
  section('1 · BROWSER LAUNCH');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  console.log('  ✓ Browser launched (Chromium, headless=false)');

  // ── 2. Navigate ────────────────────────────────────────────────────────────
  section('2 · NAVIGATION');
  await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
  const finalUrl = page.url();
  const title = await page.title();
  label('Final URL:', finalUrl);
  label('Page title:', title);

  // ── 3. What LLM currently sees ────────────────────────────────────────────
  section('3 · WHAT LLM CURRENTLY "SEES" (current system)');
  console.log('\n  After navigate tool call, the executor appends these messages:');
  console.log('\n  \x1b[33m[assistant]\x1b[0m Used navigate: {"url":"' + TARGET_URL + '"}');
  console.log('  \x1b[33m[user]\x1b[0m     Tool result: {"success":true,"message":"Navigation complete: ' + finalUrl + '"}');
  console.log('\n  \x1b[31m⚠  That\'s it. No page content. No DOM. No visual. The LLM is blind.\x1b[0m');

  const blindResponse = await callLLM(
    [
      { role: 'system', content: 'You are a browser automation agent.' },
      { role: 'user', content: `I navigated to ${TARGET_URL}. Tool result: {"success":true,"message":"Navigation complete: ${finalUrl}","title":"${title}"}. What elements can I interact with on this page?` },
    ],
    TEXT_MODEL,
    'blind LLM',
  );
  console.log('\n  \x1b[90mLLM answer with only URL/title info:\x1b[0m');
  console.log('  ' + blindResponse.replace(/\n/g, '\n  ').slice(0, 500) + (blindResponse.length > 500 ? '\n  [truncated...]' : ''));

  // ── 4. Capture rich DOM snapshot ──────────────────────────────────────────
  section('4 · RICH DOM SNAPSHOT (what we COULD send)');
  const dom = await captureDomSnapshot(page);

  label('Visible text (sample):', dom.visibleText.slice(0, 120) + '...');
  console.log(`\n  \x1b[36mInput fields (${dom.inputFields.length}):\x1b[0m`);
  dom.inputFields.forEach((f) => console.log(`    • ${f}`));
  console.log(`\n  \x1b[36mClickable elements (${dom.clickableElements.length}):\x1b[0m`);
  dom.clickableElements.slice(0, 12).forEach((e) => console.log(`    • ${e}`));
  if (dom.clickableElements.length > 12)
    console.log(`    ... and ${dom.clickableElements.length - 12} more`);
  console.log(`\n  \x1b[36mLinks (${dom.allLinks.length}):\x1b[0m`);
  dom.allLinks.slice(0, 8).forEach((l) => console.log(`    • "${l.text}" → ${l.href}`));
  if (dom.allLinks.length > 8)
    console.log(`    ... and ${dom.allLinks.length - 8} more`);

  label('\n  Has modal:', String(dom.hasModal));
  label('Has captcha:', String(dom.hasCaptcha));
  label('Has overlay:', String(dom.hasOverlay));

  // ── 5. Capture screenshot as base64 ──────────────────────────────────────
  section('5 · SCREENSHOT CAPTURE');
  const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'jpeg', quality: 75 });
  const base64Image = screenshotBuffer.toString('base64');
  const imageDataUrl = `data:image/jpeg;base64,${base64Image}`;

  const savePath = path.join('data', 'errors', `vision-test-${Date.now()}.jpg`);
  fs.mkdirSync(path.dirname(savePath), { recursive: true });
  fs.writeFileSync(savePath, screenshotBuffer);
  label('Screenshot size:', `${(screenshotBuffer.length / 1024).toFixed(1)} KB`);
  label('Base64 size:', `${(base64Image.length / 1024).toFixed(1)} KB`);
  label('Saved to:', savePath);
  console.log('\n  \x1b[31mCurrent system:\x1b[0m Only sends the file path string to LLM — image never seen.');
  console.log('  \x1b[32mWith vision:\x1b[0m  Base64-encode and embed in message → LLM sees pixels.');

  // ── 6. LLM with DOM text snapshot ────────────────────────────────────────
  section('6 · LLM WITH DOM TEXT SNAPSHOT');
  const domContext = `
Page URL: ${dom.url}
Page Title: ${dom.title}
Has modal: ${dom.hasModal} | Has captcha: ${dom.hasCaptcha} | Has overlay: ${dom.hasOverlay}

VISIBLE TEXT (sample):
${dom.visibleText.slice(0, 800)}

INPUT FIELDS:
${dom.inputFields.join('\n')}

CLICKABLE ELEMENTS:
${dom.clickableElements.join('\n')}

LINKS:
${dom.allLinks.slice(0, 15).map((l) => `"${l.text}" → ${l.href}`).join('\n')}
`.trim();

  const domResponse = await callLLM(
    [
      { role: 'system', content: 'You are a browser automation agent. Based on the DOM snapshot provided, describe exactly what interactive elements are on the page and how to accomplish tasks.' },
      { role: 'user', content: `Here is a live DOM snapshot of the page:\n\n${domContext}\n\nWhat elements can I interact with? How would I type in the search box and submit a search?` },
    ],
    TEXT_MODEL,
    'DOM text LLM',
  );
  console.log('\n  \x1b[32mLLM answer with DOM snapshot:\x1b[0m');
  console.log('  ' + domResponse.replace(/\n/g, '\n  ').slice(0, 800) + (domResponse.length > 800 ? '\n  [truncated...]' : ''));

  // ── 7. LLM with vision (screenshot) ──────────────────────────────────────
  section('7 · LLM WITH VISION (screenshot as base64 image)');
  console.log('  Sending screenshot directly to a vision-capable LLM...\n');

  const visionResponse = await callLLM(
    [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: imageDataUrl },
          },
          {
            type: 'text',
            text: 'This is a screenshot of a browser page. Describe: (1) what page this is, (2) all visible interactive elements you can see (inputs, buttons, links), (3) exactly what selectors or actions I should use to interact with the search box.',
          },
        ],
      },
    ],
    VISION_MODEL,
    'vision LLM',
  );
  console.log('  \x1b[32mVision LLM answer:\x1b[0m');
  console.log('  ' + visionResponse.replace(/\n/g, '\n  ').slice(0, 1000) + (visionResponse.length > 1000 ? '\n  [truncated...]' : ''));

  // ── 8. Summary ────────────────────────────────────────────────────────────
  section('8 · DIAGNOSIS SUMMARY');
  console.log(`
  ┌─────────────────────────────────────┬──────────────┬──────────────────────┐
  │ Method                              │ Cost         │ Page Understanding   │
  ├─────────────────────────────────────┼──────────────┼──────────────────────┤
  │ Current: URL + title only           │ 0 extra tok  │ ❌ Blind — guessing  │
  │ DOM text snapshot (text model)      │ ~500–1k tok  │ ✅ Full DOM context   │
  │ Screenshot vision (vision model)    │ ~1–3k tok    │ ✅ Visual context     │
  │ DOM + Screenshot combined           │ ~2–4k tok    │ ✅✅ Best accuracy   │
  └─────────────────────────────────────┴──────────────┴──────────────────────┘

  \x1b[33mRecommendation:\x1b[0m
  • Auto-inject a DOM snapshot into the conversation after every navigate/page-change
  • Optionally send screenshot as base64 for visual confirmation (vision models)
  • This gives the LLM real context to pick correct selectors instead of guessing
`);

  await browser.close();
  console.log('  ✓ Browser closed.\n');
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
  process.exit(1);
});
