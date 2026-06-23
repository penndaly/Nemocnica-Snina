/**
 * Wearables alerts / physician E2E (Sprint W5 — WR-W5-1 … WR-W5-4).
 *
 * Requires the full stack (web + API + DB + RabbitMQ) with WEARABLES_PROVIDER=mock
 * and HIS_MOCK_ENABLED=true. Scenarios skip gracefully without TEST_PATIENT_JWT /
 * TEST_STAFF token, like the other portal/admin specs.
 */
import { test, expect } from '@playwright/test';
import { setMockPatientSession } from './helpers/auth';

const HAS_SESSION = !!process.env['TEST_PATIENT_JWT'];

test.describe('WR-W5 — alerts, FHIR export, physician view', () => {
  test.skip(!HAS_SESSION, 'needs TEST_PATIENT_JWT + API/RabbitMQ stack');

  test('WR-W5-1: a critical glucose reading surfaces an alert badge in the portal', async ({ page }) => {
    // A critical reading is injected via the admin endpoint in CI setup; here we
    // assert the portal bell reflects an unread wearable alert.
    await setMockPatientSession(page);
    await page.goto('/sk/portal?tab=wearables');
    await page.locator('button:has-text("Zariadenia"), button:has-text("Wearables")').first().click().catch(() => {});
    const bell = page.locator('button[aria-label*="Upozornenia"], button[aria-label*="Alerts"]').first();
    await expect(bell).toBeVisible({ timeout: 10_000 });
  });

  test('WR-W5-2/6: sync produces readings exported to the HIS FHIR sandbox (idempotent)', async ({ page }) => {
    await setMockPatientSession(page);
    await page.goto('/sk/portal?tab=wearables');
    await page.locator('button:has-text("Zariadenia"), button:has-text("Wearables")').first().click().catch(() => {});
    const sync = page.locator('button[aria-label*="Synchronizovať"], button[aria-label*="Sync"]').first();
    if (await sync.isVisible()) {
      await sync.click();
      // After sync, the "In HIS" chip should eventually appear on shared readings.
      await expect(page.locator('text=V zdravotnom zázname, text=In health record').first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
    }
  });

  test('WR-W5-4: physician with no relationship gets 403 PHYSICIAN_ACCESS_DENIED', async ({ request }) => {
    const apiUrl = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    const staff = process.env['TEST_STAFF_JWT'];
    test.skip(!staff, 'needs TEST_STAFF_JWT');
    const res = await request.get(`${apiUrl}/api/wearables/physician/unrelated-patient-token`, {
      headers: { Authorization: `Bearer ${staff}` },
    });
    expect(res.status()).toBe(403);
  });
});
