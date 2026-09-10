/**
 * SPRINT UI-1a Task 1 — hero copy-cap/scrim-direction breakpoint regression.
 *
 * The bug this file exists to catch: packages/ui/src/globals.css's hero
 * copy-width cap (`.has-hero-media > .container > *:not(.hero-grid):not(.stepper)
 * { max-width: min(64ch, 62%) }`) and the scrim's horizontal→vertical
 * gradient switch (`max-width: 780px`) are two separate media queries that
 * must always stay complementary — the cap must start exactly where the
 * horizontal (fades-to-transparent) gradient starts (781px), or there's a
 * viewport band where hero text runs into the transparent side of the scrim
 * with nothing constraining its width. That happened once already: the cap
 * was ported at `min-width: 1101px` (aligned with the unrelated nav-collapse
 * breakpoint) instead of 781px, leaving 781–1100px uncapped — measured at
 * 1.45:1 against the 4.5:1 AA requirement. See docs/03-AUDIT.md.
 *
 * axe's own color-contrast rule is disabled in a11y.spec.ts ("checked
 * separately") — this file is that separate check, for the hero specifically.
 */
import { test, expect } from '@playwright/test';

// ── WCAG relative luminance + contrast ratio ────────────────────────────
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const lA = relLuminance(a);
  const lB = relLuminance(b);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}
function compositeOver(
  [fr, fg, fb]: [number, number, number],
  fa: number,
  [br, bg, bb]: [number, number, number],
): [number, number, number] {
  return [fr * fa + br * (1 - fa), fg * fa + bg * (1 - fa), fb * fa + bb * (1 - fa)];
}

// .hero-scrim gradient stops: linear-gradient(90deg, rgba(16,44,76,.93) 0%,
// rgba(16,44,76,.90) 46%, rgba(16,44,76,.60) 72%, rgba(16,44,76,.22) 100%)
const STOPS: Array<[number, number]> = [
  [0, 0.93],
  [46, 0.9],
  [72, 0.6],
  [100, 0.22],
];
function scrimAlphaAtPct(pct: number): number {
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, a0] = STOPS[i]!;
    const [p1, a1] = STOPS[i + 1]!;
    if (pct >= p0 && pct <= p1) return a0 + ((pct - p0) / (p1 - p0)) * (a1 - a0);
  }
  return STOPS[STOPS.length - 1]![1];
}
const SCRIM_RGB: [number, number, number] = [16, 44, 76];
// Worst-case underlying ground: white. Both the placeholder-art scenes
// (packages/ui/src/placeholder-art.ts's cream/sky tones) and plausible real
// photography can get this light, so this is a legitimate worst case, not a
// hypothetical one.
const WHITE: [number, number, number] = [255, 255, 255];

const TEXT_COLORS: Record<string, [number, number, number]> = {
  h1: [255, 255, 255], // .has-hero-media h1 { color:#fff }
  lede: [0xdb, 0xe6, 0xf2], // .has-hero-media .lede { color:#dbe6f2 }
  breadcrumb: [0xdb, 0xe6, 0xf2], // .has-hero-media .breadcrumb { color:#dbe6f2 }
  breadcrumbLink: [0xd6, 0xe2, 0xf0], // .has-hero-media .breadcrumb a { color:#d6e2f0 }
  chip: [255, 255, 255], // .has-hero-media .chip { color:#fff }
};

// Vertical scrim (max-width:780px): uniform gradient(.90 top -> .86 bottom),
// no horizontal fade, so text x-position doesn't matter for contrast — use
// the lighter (.86) stop as the worst case.
const VERTICAL_SCRIM_WIDTHS = [320, 390, 780];
// Horizontal scrim (min-width:781px, the cap's own breakpoint): includes the
// exact boundary (781) and one px below it (780, covered above) plus the
// unrelated nav-collapse boundary (1100/1101) to prove the two breakpoints
// don't interact.
const HORIZONTAL_SCRIM_WIDTHS = [781, 800, 900, 1024, 1100, 1101, 1280, 1440];

async function heroContrastAtWidth(
  page: import('@playwright/test').Page,
  route: string,
  width: number,
): Promise<Array<{ selector: string; ratio: number }>> {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  const container = page.locator('.has-hero-media > .container').first();
  const containerBox = await container.boundingBox();
  if (!containerBox) return [];

  const results: Array<{ selector: string; ratio: number }> = [];
  for (const sel of ['h1', '.lede', '.breadcrumb', '.breadcrumb a', '.chip']) {
    const el = page.locator(`.has-hero-media ${sel}`).first();
    if ((await el.count()) === 0) continue;
    const box = await el.boundingBox();
    if (!box) continue;

    const rightEdgeX = box.x + box.width;
    const pct = Math.max(0, Math.min(100, ((rightEdgeX - containerBox.x) / containerBox.width) * 100));

    const bgRgb =
      width <= 780 ? compositeOver(SCRIM_RGB, 0.86, WHITE) : compositeOver(SCRIM_RGB, scrimAlphaAtPct(pct), WHITE);

    const key = sel === '.breadcrumb a' ? 'breadcrumbLink' : sel === '.breadcrumb' ? 'breadcrumb' : sel === '.chip' ? 'chip' : sel === '.lede' ? 'lede' : 'h1';
    results.push({ selector: sel, ratio: contrastRatio(TEXT_COLORS[key]!, bgRgb) });
  }
  return results;
}

test.describe('Hero contrast — copy-cap/scrim-direction breakpoint pairing', () => {
  // SPRINT_UI_1A_CONTRAST_GRID.md names this as "the single assertion that
  // would have caught this": at 900px (inside the previously-uncapped
  // 781-1100px band), hero copy's computed max-width must not be "none".
  //
  // That literal check doesn't work: Chromium's getComputedStyle reports
  // maxWidth as "none" for this element even when `max-width: min(64ch, 62%)`
  // is demonstrably the active layout constraint — a real serialization
  // quirk for min()/max() CSS functions, not evidence the cap isn't applying.
  // Confirmed independently: rendered width jumps from 732px (780px
  // viewport, cap inactive) to 255px (781px viewport, cap active) at exactly
  // the breakpoint boundary — content-driven wrapping wouldn't produce a
  // step change at a specific pixel width, only an active width constraint
  // would. Asserting on the rendered width against the container instead,
  // which reliably catches the same regression (an uncapped hero at 900px
  // renders far closer to the full container width than a capped one does).
  test('hero copy is meaningfully narrower than its container at 900px (regression: cap missing at 781-1100px)', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('/sk', { waitUntil: 'domcontentloaded' });
    const container = page.locator('.has-hero-media > .container').first();
    const h1 = page.locator('.has-hero-media h1').first();
    const containerBox = await container.boundingBox();
    const h1Box = await h1.boundingBox();
    expect(containerBox).not.toBeNull();
    expect(h1Box).not.toBeNull();
    // 62% cap should keep the hero copy well under, say, 75% of the
    // container's width — an uncapped h1 runs the full container width.
    expect(h1Box!.width / containerBox!.width).toBeLessThan(0.75);
  });

  for (const width of [...VERTICAL_SCRIM_WIDTHS, ...HORIZONTAL_SCRIM_WIDTHS]) {
    test(`home hero (h1/.lede/.chip) clears 4.5:1 at ${width}px`, async ({ page }) => {
      const results = await heroContrastAtWidth(page, '/sk', width);
      for (const { selector, ratio } of results) {
        expect(ratio, `${selector} at ${width}px`).toBeGreaterThanOrEqual(4.5);
      }
    });

    test(`inner-route hero (h1/.breadcrumb) clears 4.5:1 at ${width}px`, async ({ page }) => {
      const results = await heroContrastAtWidth(page, '/sk/ambulancie', width);
      for (const { selector, ratio } of results) {
        expect(ratio, `${selector} at ${width}px`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
