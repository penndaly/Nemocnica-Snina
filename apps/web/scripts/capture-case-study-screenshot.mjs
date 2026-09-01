/**
 * Re-captures a single case-study screenshot from the design_handoff
 * prototype (design_handoff_nemocnica_snina/admin.html) — the actual
 * source of every docs/marketing/case-study-regional-hospital-platform/
 * img/*.png, not the live Next.js /admin app (which has since diverged
 * visually — dark theme, no SK/EN chrome toggle).
 *
 * The prototype uses the real seed data (real hospital name, real
 * physician roster) verbatim, so every capture must run through the
 * REPLACEMENTS mask below before screenshotting — never ship a raw
 * capture. This masks BOTH input/textarea values (bilingual content
 * fields) and rendered text nodes (nav, headings). If you add a new
 * field or route, verify with the OCR gate afterward — grep on the raw
 * HTML/JS cannot catch anything baked into rendered pixels.
 *
 * Usage:
 *   cd design_handoff_nemocnica_snina && python3 -m http.server 8899 &
 *   cd apps/web && node scripts/capture-case-study-screenshot.mjs
 *   (needs @playwright/test, resolved from apps/web's node_modules)
 */
import { chromium } from '@playwright/test';

const OUT = '../../docs/marketing/case-study-regional-hospital-platform/img/12-admin-page-content.png';

// Longest/most-specific match first. Per-language, grammatically-checked
// replacements — not one universal string dropped into both languages
// (that produced "mesta the district" / "the district district" in the
// original, broken capture).
const REPLACEMENTS = [
  [/Nemocnica Snina, s\.r\.o\./gi, 'Regional Hospital, s.r.o.'],
  [/Nemocnice Snina/gi, 'Regionálnej nemocnice'],
  [/Nemocnica Snina/gi, 'Regional Hospital'],
  [/mesta Snina/gi, 'mesta'],
  [/City of Snina/gi, 'City'],
  [/okrese Snina/gi, 'okrese'],
  [/okres Snina/gi, 'okres'],
  [/Snina district/gi, 'district'],
  [/obyvateľov Sniny/gi, 'obyvateľov regiónu'],
  [/people of Snina/gi, 'people of the district'],
  // Safety-net fallback — logs so a gap in the specific rules above is visible.
  [/\bSnin[a-zžťľčšťýáíéóúäô]*\b/gi, '__FALLBACK__'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 924, height: 540 } });

await page.goto('http://localhost:8899/admin.html');
await page.waitForTimeout(500);
await page.fill('input[type="password"]', 'admin');
await page.click('button:has-text("Prihlásiť")');
await page.waitForTimeout(800);
await page.locator('button', { hasText: /^EN$/ }).click();
await page.waitForTimeout(500);
await page.locator('text=Page content').click();
await page.waitForTimeout(800);

const fallbackHits = await page.evaluate((replacementsSrc) => {
  const hits = [];
  function mask(s) {
    let out = s;
    for (const [pattern, flags, repl] of replacementsSrc) {
      const re = new RegExp(pattern, flags);
      out = out.replace(re, repl === '__FALLBACK__' ? (m) => { hits.push(m); return 'regiónu'; } : repl);
    }
    return out;
  }
  document.querySelectorAll('input, textarea').forEach((el) => {
    const masked = mask(el.value);
    if (masked !== el.value) el.value = masked;
  });
  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE']);
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => SKIP_TAGS.has(node.parentElement?.tagName)
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  nodes.forEach((node) => {
    const masked = mask(node.nodeValue);
    if (masked !== node.nodeValue) node.nodeValue = masked;
  });
  return hits;
}, REPLACEMENTS.map(([re, repl]) => [re.source, re.flags, repl === '__FALLBACK__' ? '__FALLBACK__' : repl]));

if (fallbackHits.length) console.warn('[mask fallback used]', fallbackHits);

await page.waitForTimeout(300);
await page.screenshot({ path: OUT });
console.log('captured to', OUT);
await browser.close();
