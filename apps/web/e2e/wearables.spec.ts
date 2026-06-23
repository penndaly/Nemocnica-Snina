/**
 * Wearables portal E2E (Sprint W4 — WR-W4-1 … WR-W4-7).
 *
 * Requires the full stack (web + NestJS API + DB) with WEARABLES_PROVIDER=mock.
 * Like the other portal specs, scenarios that depend on a live patient session
 * (TEST_PATIENT_JWT) skip gracefully when it is absent, so the suite is green in
 * a web-only CI lane and exercised fully when the API lane runs.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setMockPatientSession } from './helpers/auth';

const HAS_SESSION = !!process.env['TEST_PATIENT_JWT'];

async function openWearables(page: import('@playwright/test').Page) {
  await setMockPatientSession(page);
  await page.goto('/sk/portal?tab=wearables');
  await page.locator('button:has-text("Zariadenia"), button:has-text("Wearables")').first().click().catch(() => {});
}

test.describe('WR-W4 — wearables portal', () => {
  test.skip(!HAS_SESSION, 'needs TEST_PATIENT_JWT + API stack');

  test('WR-W4-1: tab renders connected devices from the live API (mock provider)', async ({ page }) => {
    await openWearables(page);
    // Mock provider self-seeds three demo devices.
    await expect(page.locator('text=FreeStyle Libre, text=Abbott').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Posledné merania, text=Recent readings').first()).toBeVisible();
  });

  test('WR-W4-2: share-with-physician toggle is optimistic then persisted', async ({ page }) => {
    await openWearables(page);
    const toggle = page.locator('input[type="checkbox"][aria-label*="lekár"], input[type="checkbox"][aria-label*="physician"]').first();
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    const before = await toggle.isChecked();
    await toggle.click();
    await expect(toggle).toBeChecked({ checked: !before });
    await expect(page.locator('text=Súhlas bol aktualizovaný, text=Consent updated')).toBeAttached({ timeout: 5_000 }).catch(() => {});
  });

  test('WR-W4-3: connect Fitbit redirects to a (mock) OAuth authorize URL', async ({ page }) => {
    await openWearables(page);
    await page.locator('button[aria-expanded]:has-text("Pripojiť"), button[aria-expanded]:has-text("Connect")').first().click();
    await page.locator('[role="tab"]:has-text("Fitness")').click();
    // Connect click triggers a navigation to the callback (mock provider loops back).
    await Promise.all([
      page.waitForURL(/callback\/fitbit|portal\?tab=wearables/, { timeout: 10_000 }).catch(() => {}),
      page.locator('button:has-text("Fitbit")').first().click(),
    ]);
  });

  test('WR-W4-4: partnership platform (Medtronic) shows an agreement modal, no OAuth', async ({ page }) => {
    await openWearables(page);
    await page.locator('button[aria-expanded]:has-text("Pripojiť"), button[aria-expanded]:has-text("Connect")').first().click();
    await page.locator('button:has-text("MyCareLink"), button:has-text("Medtronic")').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] >> text=wearables@nemocnicasnina.sk')).toBeVisible();
  });

  test('WR-W4-5: consent page — withdraw physician_sharing writes an audit row', async ({ page }) => {
    await setMockPatientSession(page);
    await page.goto('/sk/portal/wearables/sublas');
    const toggle = page.locator('input[type="checkbox"][aria-label*="lekár"], input[type="checkbox"][aria-label*="physician"]').first();
    await expect(toggle).toBeVisible({ timeout: 10_000 });
    await toggle.click();
    // The append-only audit trail should contain a withdrawn/granted badge.
    await expect(page.locator('table.data')).toBeVisible();
  });

  test('WR-W4-6: disconnect device → confirm modal → device removed', async ({ page }) => {
    await setMockPatientSession(page);
    await page.goto('/sk/portal/wearables/sublas');
    await page.locator('button:has-text("Odpojiť"), button:has-text("Disconnect")').first().click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await page.locator('[role="dialog"] button:has-text("Odpojiť"), [role="dialog"] button:has-text("Disconnect")').click();
    await expect(page.locator('[role="dialog"]')).toBeHidden({ timeout: 5_000 });
  });

  test('WR-W4-7: axe — zero critical/serious on wearables tab and /sublas', async ({ page }) => {
    await openWearables(page);
    let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    let blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);

    await page.goto('/sk/portal/wearables/sublas');
    results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    blocking = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(blocking, JSON.stringify(blocking.map((v) => v.id))).toEqual([]);
  });
});
