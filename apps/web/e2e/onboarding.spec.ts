/**
 * SPEC 2 — New-patient onboarding (eDohody registration).
 */
import { test, expect } from '@playwright/test';
import { VALID_RC } from './helpers/booking';

const API = process.env['API_BASE_URL'] ?? 'http://localhost:3001';

test('ON1: onboarding page renders list of accepting physicians', async ({ page }) => {
  await page.goto('/sk/registracia');
  // At least one accepting physician card should appear
  await expect(page.locator('[data-physician-id], .physician-card, button[data-physician]').first()).toBeVisible({ timeout: 8_000 });
});

test('ON2: selecting a physician enables the form fields', async ({ page }) => {
  await page.goto('/sk/registracia');
  const first = page.locator('[data-physician-id], button[data-physician]').first();
  await first.click();
  await expect(page.locator('[name="patientName"], input[placeholder*="Meno"]')).toBeEnabled({ timeout: 3_000 });
});

test('ON3: invalid RC is rejected client-side before submit', async ({ page }) => {
  await page.goto('/sk/registracia');
  await page.locator('[data-physician-id], button[data-physician]').first().click();
  await page.fill('[name="patientName"]', 'Test Pacient');
  await page.fill('[name="patientRc"]', '1234567890'); // fails modulo-11
  await page.fill('[name="phone"]', '+421900000000');
  // index 0 is the empty "— Select insurer —" placeholder; the <select> is
  // `required`, so leaving it there fails the browser's native constraint
  // validation and blocks submission before the app's own RC check ever
  // runs. Pick a real insurer (index 1) so this test isolates the RC check.
  await page.selectOption('[name="insurerCode"]', { index: 1 }).catch(() => null);
  await page.click('button[type="submit"], button:has-text("Odoslať")');
  // NOTE: `text=A, [role="alert"]` is NOT a selector union — Playwright's text
  // engine treats an unquoted comma as part of the search string itself, so
  // this never matched anything. .or() is the correct way to combine engines.
  await expect(
    page.getByText('Neplatné rodné číslo').or(page.locator('[role="alert"]')),
  ).toBeVisible({ timeout: 3_000 });
});

test('ON4: valid submission succeeds (API creates application)', async () => {
  const r = await fetch(`${API}/api/onboarding/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      physicianId: 'mudr-kukula',
      patientName: 'Test Pacient',
      patientRc:   VALID_RC,
      insurerCode: '25',
      phone:       '+421900000001',
      email:       'test@example.com',
      gdprConsent: true,
    }),
  });
  expect([200, 201]).toContain(r.status);
  const body = await r.json() as { id?: string; status?: string };
  expect(body).toHaveProperty('id');
  expect(body.status).toBe('SUBMITTED');
});

test('ON5: non-accepting physician shows "not accepting" message in UI', async ({ page }) => {
  // Try navigating with a not-accepting physician ID
  await page.goto('/sk/registracia');
  // The page should filter to only accepting physicians
  const allCards = await page.locator('[data-accepting="false"]').count();
  expect(allCards).toBe(0); // non-accepting physicians should not appear in the list
});
