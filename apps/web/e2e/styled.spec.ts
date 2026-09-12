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

test('prose links are underlined, not colour-only (axe link-in-text-block; STG-2)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, '/sk/kariera');
  // The HR contact mailto sits inside a <p> — the exact element axe flagged.
  expect(await computed(page, 'p a[href^="mailto:"]', 'text-decoration-line')).toBe('underline');
  await open(page, '/sk/pre-pacientov');
  expect(await computed(page, 'p a', 'text-decoration-line')).toBe('underline');
  // Buttons keep their own affordance.
  expect(await computed(page, 'a.btn', 'text-decoration-line')).toBe('none');
});

// ── 3. Header: grouped nav must never overlap the CTAs, per locale (UI-2b) ──
// UI-3 (docs/03-AUDIT.md): `.nav-links` overflowed into the CTA buttons —
// uk at every desktop width, sk at the 1101px boundary. Invisible to the
// no-scroll ladder because the overflow is inside the header. The header
// now measures itself and collapses to the hamburger when the locale's
// labels would not fit (SiteHeader.tsx, UI-2b). This assertion — not the
// ladder — is what catches a regression: for every locale × width, either
// the nav is expanded and its last item ends left of the first CTA, or it
// is collapsed and the hamburger is the visible control.
const HEADER_LOCALES = ['sk', 'en', 'cs', 'pl', 'hu', 'uk'] as const;
const HEADER_WIDTHS = [1101, 1280, 1440] as const;

interface HeaderProbe {
  state: string | null;
  navDisplay: string;
  navVisibility: string;
  lastNavRight: number | null;
  firstCtaLeft: number | null;
  hamburgerDisplay: string;
  navInert: boolean;
  scrollWidth: number;
}

async function probeHeader(page: Page): Promise<HeaderProbe> {
  return page.evaluate(() => {
    const header = document.querySelector('header.site-header') as HTMLElement | null;
    const nav = document.querySelector('header.site-header .nav-links') as HTMLElement | null;
    const tops = Array.from(document.querySelectorAll('header.site-header .nav-links .nav-top')) as HTMLElement[];
    const cta = document.querySelector('header.site-header .header-ctas .btn') as HTMLElement | null;
    const burger = document.querySelector('header.site-header .show-mobile') as HTMLElement | null;
    const last = tops[tops.length - 1];
    return {
      state: header?.getAttribute('data-nav') ?? null,
      navDisplay: nav ? getComputedStyle(nav).display : 'NO-ELEMENT',
      navVisibility: nav ? getComputedStyle(nav).visibility : 'NO-ELEMENT',
      lastNavRight: last ? last.getBoundingClientRect().right : null,
      firstCtaLeft: cta ? cta.getBoundingClientRect().left : null,
      hamburgerDisplay: burger ? getComputedStyle(burger).display : 'NO-ELEMENT',
      navInert: !!nav?.hasAttribute('inert'),
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

for (const locale of HEADER_LOCALES) {
  test(`header: nav never overlaps CTAs — /${locale} at ${HEADER_WIDTHS.join('/')}px (UI-2b)`, async ({ page }) => {
    test.setTimeout(120_000);
    const report: string[] = [];
    for (const width of HEADER_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, `/${locale}`);
      // Fonts change label widths; the header re-measures on fonts.ready.
      await page.evaluate(() => document.fonts.ready);
      const p = await probeHeader(page);
      report.push(`${locale}@${width}: ${p.state} navRight=${p.lastNavRight?.toFixed(0)} ctaLeft=${p.firstCtaLeft?.toFixed(0)}`);
      expect(p.scrollWidth, `${locale}@${width} page overflows`).toBeLessThanOrEqual(width);
      expect(p.state, `${locale}@${width} data-nav missing`).not.toBeNull();
      if (p.state === 'expanded') {
        expect(p.navDisplay, `${locale}@${width} expanded nav not displayed`).toBe('flex');
        expect(p.navVisibility).toBe('visible');
        expect(p.hamburgerDisplay, `${locale}@${width} hamburger shown while expanded`).toBe('none');
        expect(p.lastNavRight, `${locale}@${width} no .nav-top`).not.toBeNull();
        expect(p.firstCtaLeft, `${locale}@${width} no CTA`).not.toBeNull();
        // The UI-3 defect: last group label ended right of the first CTA.
        expect(p.lastNavRight!, `${locale}@${width} nav overlaps CTA`).toBeLessThan(p.firstCtaLeft!);
      } else {
        expect(p.state).toBe('collapsed');
        expect(p.navVisibility, `${locale}@${width} collapsed nav still visible`).toBe('hidden');
        expect(p.navInert, `${locale}@${width} collapsed nav not inert`).toBe(true);
        // A <button> that is a flex item is blockified: computes 'flex', not
        // 'inline-flex'. Anything but 'none' is "shown".
        expect(p.hamburgerDisplay, `${locale}@${width} collapsed without hamburger`).not.toBe('none');
      }
    }
    test.info().annotations.push({ type: 'header-states', description: report.join(' | ') });
  });
}

test('header: sk and en keep the desktop nav at 1280/1440 (collapse must not over-trigger)', async ({ page }) => {
  // The measurement is only right if it says "fits" when it does. The two
  // primary locales fit at the common desktop widths (UI-3 table: sk only
  // overlapped at 1101px). If this starts collapsing, the sum is wrong.
  for (const locale of ['sk', 'en']) {
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page, `/${locale}`);
      await page.evaluate(() => document.fonts.ready);
      expect((await probeHeader(page)).state, `${locale}@${width}`).toBe('expanded');
    }
  }
});

test('header: collapsed nav re-expands when the viewport grows (UI-2b, same page, no reload)', async ({ page }) => {
  // sk overlaps by 38px at 1101px (UI-3 table) and fits at 1280px. Start
  // collapsed, widen, and the nav must come back without a navigation —
  // proves the off-flow re-measurement, not just the initial one. (uk is
  // not usable here: `.container` is capped at --maxw, and uk's labels need
  // more than that cap at any viewport — it stays collapsed on desktop by
  // design; see docs/03-AUDIT.md UI-2b.)
  await page.setViewportSize({ width: 1101, height: 900 });
  await open(page, '/sk');
  await page.evaluate(() => document.fonts.ready);
  expect((await probeHeader(page)).state).toBe('collapsed');
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await probeHeader(page)).state).toBe('expanded');
  const p = await probeHeader(page);
  expect(p.lastNavRight!).toBeLessThan(p.firstCtaLeft!);
  // And back down: the CSS floor is not involved at 1101, this is the JS path.
  await page.setViewportSize({ width: 1101, height: 900 });
  await expect.poll(async () => (await probeHeader(page)).state).toBe('collapsed');
});
