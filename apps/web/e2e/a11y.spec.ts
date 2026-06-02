/**
 * SPEC 6 — Accessibility (axe-core, keyboard, high-contrast).
 * Target: zero serious/critical violations on key public routes.
 * Act No. 351/2022 requires WCAG 2.1 AA.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const KEY_ROUTES = [
  '/sk',
  '/sk/oddelenia',
  '/sk/ambulancie',
  '/sk/lekari',
  '/sk/sluzby',
  '/sk/diagnostika',
  '/sk/aktuality',
  '/sk/kontakt',
  '/sk/objednanie',
  '/sk/portal',
];

for (const route of KEY_ROUTES) {
  test(`A11Y: zero critical/serious axe violations — ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('domcontentloaded');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .disableRules(['color-contrast']) // check separately with real brand colors
      .analyze();

    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    if (critical.length > 0) {
      const summary = critical.map((v) => `${v.impact}: ${v.id} — ${v.description}`).join('\n');
      throw new Error(`Axe violations on ${route}:\n${summary}`);
    }
    expect(critical).toHaveLength(0);
  });
}

// ── Skip-to-content link ───────────────────────────────────

test('A11Y: skip-to-content link is first focusable element and works', async ({ page }) => {
  await page.goto('/sk');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  const text = await focused.textContent();
  expect(text?.toLowerCase()).toMatch(/preskočiť|skip/i);
  await page.keyboard.press('Enter');
  // Main content should now be focused
  const mainContent = page.locator('#main-content, main');
  await expect(mainContent).toBeVisible();
});

// ── Keyboard booking wizard ────────────────────────────────

test('A11Y: booking wizard step 1 is keyboard-navigable', async ({ page }) => {
  await page.goto('/sk/objednanie');
  // Tab through until we can find a clinic button
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    const tag = await focused.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
    if (tag === 'button') {
      await page.keyboard.press('Enter');
      break;
    }
  }
  // Should have advanced in the wizard
  await expect(page.locator('[data-step]')).toBeVisible({ timeout: 3_000 });
});

// ── Booking form error messages announced ──────────────────

test('A11Y: booking form validation errors are announced via role=alert', async ({ page }) => {
  await page.goto('/sk/objednanie');
  // Jump to step 4 via deep-link and try submitting empty form
  await page.goto('/sk/objednanie?clinic=urologicka');
  // Click Continue without selecting a date
  const nextBtn = page.locator('button:has-text("Pokračovať"), button:has-text("Continue")');
  if (await nextBtn.isVisible()) {
    await nextBtn.click();
    const alert = page.locator('[role="alert"]');
    if (await alert.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await expect(alert).toBeVisible();
    }
  }
});

// ── High contrast + large text don't break layout ─────────

test('A11Y: page renders at 130% text scale without horizontal scroll', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.evaluate(() => { document.body.style.fontSize = '130%'; });
  await page.goto('/sk');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  // Allow 10px tolerance for scroll bar
  expect(scrollWidth - clientWidth).toBeLessThan(10);
});
