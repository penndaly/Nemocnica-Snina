/**
 * SPRINT UI-2a — "styled", not just "rendered".
 *
 * Why this file exists: Sprint ROUTE-1b's `/pre-pacientov` shipped with five
 * layout classes (`.section`, `.grid-2`, `.wait-row`, `.quote-card`,
 * `.table-wrap`) that had never been ported into globals.css. Every check at
 * the time passed — content-presence (`curl` + `grep`) found the text, and the
 * no-horizontal-scroll ladder was *happier* because inert grids stack and
 * stacking reduces width. Nothing in the verification ladder could tell
 * "rendered" from "styled". See docs/03-AUDIT.md "Class-coverage audit".
 *
 * This spec is the durable fix: for each ported layout primitive, one
 * `getComputedStyle` assertion on a real element on a real route. A class
 * with no rule (or a rule that doesn't apply) fails here and nowhere else.
 *
 * Two layers, both required (docs/03-AUDIT.md "Verification ladder"):
 *   1. scripts/audit-classes.mjs — static, catches "class defined nowhere".
 *   2. this spec              — runtime, catches "defined but not applied",
 *                               including the inline-style-beats-media-query
 *                               case that made /kontakt overflow (UI-2a).
 *
 * The no-horizontal-scroll ladder lives here too so it is a committed,
 * re-runnable check rather than a one-off script (docs/03-AUDIT.md UI-2 was
 * measured with an uncommitted one). Chromium desktop project only — the
 * viewport is set per test, so the `mobile` project adds nothing.
 */
import { test, expect, type Page } from '@playwright/test';

test.skip(({ browserName, isMobile }) => browserName !== 'chromium' || !!isMobile, 'viewport is set explicitly; desktop chromium only');

// Width ladder from SPRINT_UI_1A_CONTRAST_GRID.md Task 2 Done-when.
const LADDER = [375, 390, 414, 480, 560, 620, 768, 860, 941, 1024, 1100, 1280, 1440];
// 320px fails on every route today — the tracked, shared-shell defect UI-2
// (docs/03-AUDIT.md). Asserted as an *expected* failure so it flips loudly
// (and this annotation has to be removed) the moment UI-2 lands.
const UI2_KNOWN_FAILING_WIDTH = 320;

const PUBLIC_ROUTES = [
  '/sk',
  '/sk/oddelenia',
  '/sk/oddelenia/chirurgia',
  '/sk/ambulancie',
  '/sk/lekari',
  '/sk/sluzby',
  '/sk/diagnostika',
  '/sk/aktuality',
  '/sk/kontakt',
  '/sk/objednanie',
  '/sk/objednanie/zrusit/e2e-token',
  '/sk/portal',
  '/sk/edukacia',
  '/sk/edukacia/priprava',
  '/sk/kariera',
  '/sk/kariera/j1',
  '/sk/pre-pacientov',
  '/sk/o-nemocnici',
  '/sk/zverejnovanie',
];

/** `networkidle` never arrives on routes that poll a backend that is down
 * in this environment (`/lekari`, `/objednanie`, `/zverejnovanie` retry the
 * API) — wait for `load` + the main landmark instead; layout is settled by
 * then and the API-fed lists are not what the width ladder measures. */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(route, { waitUntil: 'load' });
  await page.locator('main').first().waitFor({ state: 'visible' });
}

async function scrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

async function computed(page: Page, selector: string, prop: string): Promise<string> {
  return page.evaluate(
    ([sel, pr]) => {
      const el = document.querySelector(sel as string);
      if (!el) return 'NO-ELEMENT';
      return getComputedStyle(el).getPropertyValue(pr as string);
    },
    [selector, prop],
  );
}

/** Number of grid tracks in a computed `grid-template-columns` ("1fr 2fr" → 2). */
function trackCount(value: string): number {
  return value === 'none' ? 0 : value.trim().split(/\s+/).length;
}

// ── 1. No-horizontal-scroll ladder (every public route, every width ≥375) ─
for (const route of PUBLIC_ROUTES) {
  test(`no horizontal scroll ≥375px — ${route}`, async ({ page }) => {
    // 13 navigations per route; the default 30s budget is too tight on a cold
    // dev server (turbopack compiles each route on first hit).
    test.setTimeout(180_000);
    const failures: string[] = [];
    for (const width of LADDER) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, route);
      const sw = await scrollWidth(page);
      if (sw > width) failures.push(`${width}px → scrollWidth ${sw}`);
    }
    expect(failures, `overflow on ${route}:\n${failures.join('\n')}`).toEqual([]);
  });

  test(`320px reflow — ${route} (UI-2, expected to fail until fixed)`, async ({ page }) => {
    test.fail(true, 'UI-2: shared-shell ~349px floor at 320px, tracked in docs/03-AUDIT.md');
    await page.setViewportSize({ width: UI2_KNOWN_FAILING_WIDTH, height: 900 });
    await open(page, route);
    expect(await scrollWidth(page)).toBeLessThanOrEqual(UI2_KNOWN_FAILING_WIDTH);
  });
}

// ── 2. Computed-style assertions, one per ported primitive ─────────────────
// Add a row here for every class you port into globals.css. If the selector
// is not on the page the test fails with NO-ELEMENT — that is deliberate: a
// probe that silently probes nothing is exactly the gap this file closes.

test('kontakt: .detail-grid collapses to one column below 940px (UI-2a)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/kontakt');
  expect(trackCount(await computed(page, '.detail-grid', 'grid-template-columns'))).toBe(2);
  expect(await computed(page, '.detail-sidebar', 'position')).toBe('sticky');

  await page.setViewportSize({ width: 390, height: 900 });
  await open(page, '/sk/kontakt');
  expect(trackCount(await computed(page, '.detail-grid', 'grid-template-columns'))).toBe(1);
  expect(await computed(page, '.detail-sidebar', 'position')).toBe('static');
});

test('pre-pacientov: ROUTE-1b primitives are styled, not just rendered', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/pre-pacientov');
  expect(await computed(page, '.section', 'padding-top')).toBe('76px');
  expect(trackCount(await computed(page, '.grid-2', 'grid-template-columns'))).toBe(2);
  expect(trackCount(await computed(page, '.grid-3', 'grid-template-columns'))).toBe(3);
  expect(await computed(page, '.wait-row', 'display')).toBe('flex');
  expect(await computed(page, '.quote-card', 'border-left-width')).toBe('4px');
  expect(await computed(page, '.table-wrap', 'overflow-x')).toBe('auto');

  await page.setViewportSize({ width: 390, height: 900 });
  await open(page, '/sk/pre-pacientov');
  expect(trackCount(await computed(page, '.grid-2', 'grid-template-columns'))).toBe(1);
  expect(trackCount(await computed(page, '.grid-3', 'grid-template-columns'))).toBe(1);
  expect(await computed(page, '.section', 'padding-top')).toBe('52px');
});

test('o-nemocnici: history timeline is styled', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/o-nemocnici');
  expect(await computed(page, '.hist-timeline', 'padding-left')).toBe('28px');
  expect(await computed(page, '.hist-item', 'position')).toBe('relative');
});

test('edukacia article: .edu-body richtext rhythm (UI-2a port)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/edukacia/priprava');
  // 1.7 × 17px base = 28.9px
  expect(parseFloat(await computed(page, '.edu-body', 'line-height'))).toBeGreaterThan(27);
  expect(await computed(page, '.edu-body', 'padding-bottom')).toBe('20px');
});

test('booking cancel: .h3 heading utility + Tailwind utilities are emitted (UI-2a port)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/objednanie/zrusit/e2e-token');
  // h1 kept for a11y, sized at h3 scale (1.35rem × 16px root = 21.6px)
  expect(parseFloat(await computed(page, 'h1.h3', 'font-size'))).toBeLessThan(24);
  // Tailwind is on the allowlist in scripts/audit-classes.mjs on the strength
  // of this assertion — if `@tailwind utilities` ever stops being emitted,
  // this is where it shows.
  expect(await computed(page, '.container.py-16', 'display')).toBe('flex');
  expect(await computed(page, '.container.py-16', 'padding-top')).toBe('64px');
  expect(await computed(page, '.flex.gap-3', 'gap')).toBe('12px');
});

test('.spin busy-state animation resolves (UI-2a port; admin-only markup)', async ({ page }) => {
  // The only consumers are behind admin auth; the rule is global, so probe a
  // synthetic element on a public page rather than log in.
  await open(page, '/sk');
  const anim = await page.evaluate(() => {
    const el = document.createElement('i');
    el.className = 'spin';
    document.body.appendChild(el);
    const name = getComputedStyle(el).animationName;
    el.remove();
    return name;
  });
  expect(anim).toBe('spin');
});
