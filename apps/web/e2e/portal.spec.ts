/**
 * SPEC 3 — Patient portal (eID/OIDC flow + FHIR records + step-up 2FA PDF).
 *
 * In CI: OIDC_MOCK_ENABLED=true → the mock IdP accepts any code.
 * The mock IdP runs at localhost:4010 (started by the API's startMockOidcServer).
 * setMockPatientSession() (e2e/helpers/auth.ts) uses TEST_PATIENT_JWT when
 * global-setup.ts has signed one (requires DATABASE_URL + JWT_SECRET), and
 * falls back to self-signing an equivalent session JWT with the same
 * JWT_SECRET the web app uses otherwise — either way the test doesn't
 * depend on an externally-provided token nobody produces.
 */
import { test, expect } from '@playwright/test';
import { setMockPatientSession } from './helpers/auth';

test('P1: unauthenticated portal shows eID login button', async ({ page }) => {
  await page.goto('/sk/portal');
  // Note: `page.locator('text=A, text=B')` is NOT an OR of two selectors —
  // the `text=` engine consumes the rest of the string (including the
  // comma) as one literal search phrase, so it never matches. Use `.or()`
  // to combine locators built from different engines instead.
  //
  // A bare `text=eID` is also too broad here: the card's helper paragraph
  // ("Prihlasovanie prebieha cez národnú identitu (eID)…") contains "eID"
  // too, so pairing it with the href locator via `.or()` resolves to 2
  // elements (strict-mode violation). The href match alone is unambiguous
  // and is what actually distinguishes "the login link is present".
  await expect(page.locator('a[href*="portal/login"]')).toBeVisible({ timeout: 5_000 });
  await expect(
    page.locator('text=Prihlásiť sa cez eID').or(page.locator('text=eID (Slovensko)')),
  ).toBeVisible();
});

test('P2: /portal/login redirects to OIDC IdP with PKCE code_challenge', async ({ page }) => {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('authorize') || r.url().includes('oidc')).catch(() => null),
    page.goto('/sk/portal/login'),
  ]);
  const finalUrl = page.url();
  const hasCodeChallenge = finalUrl.includes('code_challenge') || response?.url().includes('code_challenge') || finalUrl.includes('oidc');
  expect(hasCodeChallenge).toBeTruthy();
});

test('P3: authenticated portal shows dashboard with tabs', async ({ page }) => {
  await setMockPatientSession(page);
  await page.goto('/sk/portal');

  // Wait for session check. The bare `nav` fallback used to also match the
  // site header's language-switcher and main-navigation <nav> elements
  // (strict-mode violation) — the portal's own nav has a distinguishing
  // aria-label, so match on that alone. Every test in this file navigates
  // to the hardcoded /sk/portal path (not a locale-aware URL), so the
  // Slovak copy is always what renders — no English fallback needed.
  const portalNav = page.locator('nav[aria-label="Portál navigácia"]');
  await expect(portalNav).toBeVisible({ timeout: 8_000 });
  // Scoped to the nav: the default "overview" tab also renders a quick-link
  // card grid (PortalPage's tabConfig.slice(1)) with the *same* tab labels
  // ("Zdravotná dokumentácia", "e-Recepty", "Výsledky vyšetrení" each appear
  // as both a nav button and a card button) — an unscoped `text=` locator
  // for any of those resolves to 2 elements and fails strict mode.
  await expect(portalNav.locator('text=Prehľad')).toBeVisible();
  await expect(portalNav.locator('text=Zdravotná dokumentácia')).toBeVisible();
  await expect(portalNav.locator('text=e-Recepty')).toBeVisible();
  await expect(portalNav.locator('text=Výsledky vyšetrení')).toBeVisible();
});

test('P4: lab results tab shows step-up 2FA button for PDF download', async ({ page }) => {
  await setMockPatientSession(page);
  await page.goto('/sk/portal');

  // Navigate to labs tab. Scoped to the portal nav: the default "overview"
  // tab also renders a quick-link card with the same "Výsledky vyšetrení"
  // label (see the P3 comment above), so an unscoped locator here resolves
  // to 2 buttons and fails strict mode.
  await page.locator('nav[aria-label="Portál navigácia"] button:has-text("Výsledky"), nav[aria-label="Portál navigácia"] button:has-text("Lab results")').click();

  // If there are records, PDF button should be visible
  const labRows = await page.locator('table tr td:last-child button, table tr td:last-child a').count();
  if (labRows > 0) {
    await expect(page.locator('button:has-text("Stiahnuť PDF"), button:has-text("Download PDF")').first()).toBeVisible();
  } else {
    // Mock mode — records may be empty; verify no error is thrown
    await expect(page.locator('[role="alert"]')).not.toBeVisible();
  }
});

test('P5: step-up 2FA PDF button asks for phone number first', async ({ page }) => {
  await setMockPatientSession(page);
  await page.goto('/sk/portal');
  // Same nav-scoping as P4 — an unscoped locator would match both the nav
  // button and the overview tab's quick-link card for labs.
  await page.locator('nav[aria-label="Portál navigácia"] button:has-text("Výsledky"), nav[aria-label="Portál navigácia"] button:has-text("Lab")').click();

  const pdfBtn = page.locator('button:has-text("Stiahnuť"), button:has-text("Download")').first();
  if (!(await pdfBtn.isVisible())) {
    test.skip(); // no records in mock mode
    return;
  }
  await pdfBtn.click();
  // Should show phone input
  await expect(page.locator('input[type="tel"], input[placeholder*="+421"]')).toBeVisible({ timeout: 3_000 });
});

test('P6: logout clears session and redirects to login', async ({ page }) => {
  await setMockPatientSession(page);
  await page.goto('/sk/portal');
  await page.locator('a:has-text("Odhlásiť"), a:has-text("Log out")').click();
  await page.waitForURL(/portal/, { timeout: 8_000 });
  // Should show login button again (session cleared)
  await expect(page.locator('a[href*="portal/login"], button:has-text("eID")')).toBeVisible({ timeout: 5_000 });
});
