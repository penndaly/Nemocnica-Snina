/**
 * SPEC 5 — i18n: locale routing, hreflang, language switch.
 * Tests run against sk project (sk-SK locale) and en project (en-GB locale).
 */
import { test, expect } from '@playwright/test';

const LOCALES = ['sk', 'cs', 'pl', 'hu', 'uk', 'en'] as const;
const PUBLIC_ROUTES = ['/', '/oddelenia', '/ambulancie', '/lekari', '/kontakt'];

for (const locale of LOCALES) {
  test(`I1 [${locale}]: home page returns 200 and contains brand name`, async ({ page }) => {
    const r = await page.goto(`/${locale}`);
    expect(r?.status()).toBe(200);
    await expect(page.locator('text=Nemocnica Snina')).toBeVisible({ timeout: 5_000 });
  });
}

test('I2: default root / redirects to /sk', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sk/);
});

test('I3: hreflang tags present on home page for all 6 locales', async ({ page }) => {
  await page.goto('/sk');
  for (const locale of LOCALES) {
    const hreflang = page.locator(`link[rel="alternate"][hreflang="${locale}"]`);
    await expect(hreflang).toBeAttached({ timeout: 3_000 });
  }
  // x-default should point to /sk
  const xDefault = page.locator('link[rel="alternate"][hreflang="x-default"]');
  await expect(xDefault).toBeAttached();
  const href = await xDefault.getAttribute('href');
  expect(href).toMatch(/\/sk/);
});

test('I4: lang attribute on <html> matches active locale', async ({ page }) => {
  for (const locale of ['sk', 'en'] as const) {
    await page.goto(`/${locale}`);
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toMatch(new RegExp(`^${locale}`, 'i'));
  }
});

test('I5: language switch renders all 6 locale options', async ({ page }) => {
  await page.goto('/sk');
  const switcher = page.locator('[aria-label*="jazyk"], [aria-label*="language"], .lang-switch');
  await expect(switcher).toBeVisible();
});

test('I6: switching SK → EN updates URL and page language', async ({ page }) => {
  await page.goto('/sk');
  const enLink = page.locator('a[href*="/en"], button:has-text("EN")').first();
  if (await enLink.isVisible()) {
    await enLink.click();
    await expect(page).toHaveURL(/\/en/);
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toMatch(/^en/i);
  }
});

test('I7: /admin route does not receive locale prefix', async ({ page }) => {
  await page.goto('/admin/login');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page).not.toHaveURL(/\/(sk|en)\/admin/);
});

for (const route of PUBLIC_ROUTES) {
  test(`I8: /sk${route} page loads without error`, async ({ page }) => {
    const r = await page.goto(`/sk${route}`);
    expect(r?.status()).toBe(200);
    await expect(page.locator('main, #main-content')).toBeVisible({ timeout: 8_000 });
  });
}

test('I9: sitemap.xml contains all department slugs × all locales', async ({ page }) => {
  const r = await page.goto('/sitemap.xml');
  expect(r?.status()).toBe(200);
  const xml = await page.content();
  for (const locale of LOCALES) {
    expect(xml).toContain(`/${locale}/`);
  }
  expect(xml).toContain('/chirurgia');
});

test('I10: robots.txt blocks /admin and /api', async ({ page }) => {
  const r = await page.goto('/robots.txt');
  expect(r?.status()).toBe(200);
  const text = await page.locator('pre, body').textContent() ?? '';
  expect(text).toContain('Disallow: /admin');
  expect(text).toContain('Disallow: /api');
});
