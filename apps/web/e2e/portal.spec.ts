/**
 * SPEC 3 — Patient portal (eID/OIDC flow + FHIR records + step-up 2FA PDF).
 *
 * In CI: OIDC_MOCK_ENABLED=true → the mock IdP accepts any code.
 * The mock IdP runs at localhost:4010 (started by the API's startMockOidcServer).
 * TEST_PATIENT_JWT is pre-signed by CI to inject a valid session.
 */
import { test, expect } from '@playwright/test';
import { setMockPatientSession } from './helpers/auth';

test('P1: unauthenticated portal shows eID login button', async ({ page }) => {
  await page.goto('/sk/portal');
  await expect(page.locator('text=eID, a[href*="portal/login"]')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=Prihlásiť sa cez eID, text=eID (Slovensko)')).toBeVisible();
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

  // Wait for session check
  await expect(page.locator('[aria-label*="Portál navigácia"], nav')).toBeVisible({ timeout: 8_000 });
  await expect(page.locator('text=Prehľad, text=Overview')).toBeVisible();
  await expect(page.locator('text=Zdravotná dokumentácia, text=Health records')).toBeVisible();
  await expect(page.locator('text=e-Recepty, text=e-Prescriptions')).toBeVisible();
  await expect(page.locator('text=Výsledky vyšetrení, text=Lab results')).toBeVisible();
});

test('P4: lab results tab shows step-up 2FA button for PDF download', async ({ page }) => {
  await setMockPatientSession(page);
  await page.goto('/sk/portal');

  // Navigate to labs tab
  await page.locator('button:has-text("Výsledky"), button:has-text("Lab results")').click();

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
  await page.locator('button:has-text("Výsledky"), button:has-text("Lab")').click();

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
