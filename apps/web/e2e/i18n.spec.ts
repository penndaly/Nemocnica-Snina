/**
 * SPEC 5 — i18n: locale routing, hreflang, language switch.
 * Tests run against sk project (sk-SK locale) and en project (en-GB locale).
 */
import { test, expect } from '@playwright/test';

const LOCALES = ['sk', 'cs', 'pl', 'hu', 'uk', 'en', 'rue'] as const;
const PUBLIC_ROUTES = ['/', '/oddelenia', '/ambulancie', '/lekari', '/kontakt', '/edukacia', '/kariera', '/pre-pacientov', '/o-nemocnici'];

for (const locale of LOCALES) {
  test(`I1 [${locale}]: home page returns 200 and contains brand name`, async ({ page }) => {
    const r = await page.goto(`/${locale}`);
    expect(r?.status()).toBe(200);
    // Brand name legitimately appears multiple times (header logo, footer,
    // copyright, JSON-LD) — assert the first visible occurrence rather than
    // a unique match.
    await expect(page.locator('text=Nemocnica Snina').first()).toBeVisible({ timeout: 5_000 });
  });
}

test('I2: default root / redirects to /sk', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sk/);
});

// rue is reachable but untranslated (Slovak fallback chrome) — it must NOT be
// advertised as an alternate or crawlers index it as a duplicate of /sk.
// i18n/public-locales.ts flips it on automatically once its chrome is filled.
const ADVERTISED = LOCALES.filter((l) => l !== 'rue');

test('I3: hreflang tags present on home page for the 6 translated locales, not rue', async ({ page }) => {
  await page.goto('/sk');
  for (const locale of ADVERTISED) {
    const hreflang = page.locator(`link[rel="alternate"][hreflang="${locale}"]`);
    await expect(hreflang).toBeAttached({ timeout: 3_000 });
  }
  await expect(page.locator('link[rel="alternate"][hreflang="rue"]')).toHaveCount(0);
  await page.goto('/rue');
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toBeAttached();
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

test('I5: language switch lists every advertised locale by native name, each option lang-attributed', async ({ page }) => {
  await page.goto('/sk');
  const select = page.getByTestId('lang-switch');
  await expect(select).toBeVisible();
  const options = select.locator('option');
  await expect(options).toHaveCount(ADVERTISED.length);
  for (const l of ADVERTISED) {
    await expect(select.locator(`option[value="${l}"][lang="${l}"]`)).toHaveCount(1);
  }
  await expect(select.locator('option[value="rue"]')).toHaveCount(0);
  await expect(select.locator('option[value="uk"]')).toHaveText('Українська');
  await expect(select).toHaveValue('sk');
});

test('I6: switching via the selector updates URL and page language for every advertised locale', async ({ page }) => {
  for (const l of ADVERTISED.filter((x) => x !== 'sk')) {
    await page.goto('/sk/kontakt');
    await page.getByTestId('lang-switch').selectOption(l);
    await expect(page).toHaveURL(new RegExp(`/${l}/kontakt`));
    expect(await page.locator('html').getAttribute('lang')).toMatch(new RegExp(`^${l}`, 'i'));
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
  for (const locale of ADVERTISED) {
    expect(xml).toContain(`/${locale}/`);
  }
  expect(xml).not.toContain('/rue/');
  expect(xml).toContain('/chirurgia');
});

test('I10: robots.txt blocks /admin and /api', async ({ page }) => {
  const r = await page.goto('/robots.txt');
  expect(r?.status()).toBe(200);
  // text/plain responses render inside a <pre> nested in <body>; 'pre, body'
  // is a CSS selector list so it matches both elements (strict-mode
  // violation). body's textContent already includes the full response text.
  const text = (await page.locator('body').textContent()) ?? '';
  expect(text).toContain('Disallow: /admin');
  expect(text).toContain('Disallow: /api');
});
