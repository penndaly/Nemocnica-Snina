/**
 * Admin login helper for E2E tests.
 * Uses the seeded test-clinician account + known TOTP secret.
 */
import { Page } from '@playwright/test';
import * as OTPAuth from 'otplib';

const STAFF_EMAIL  = process.env['TEST_STAFF_EMAIL']  ?? 'test-clinician@nemocnicasnina.sk';
const STAFF_PASS   = 'TestPass123!';
const TOTP_SECRET  = process.env['TEST_TOTP_SECRET']  ?? 'JBSWY3DPEHPK3PXP';

export async function adminLogin(page: Page): Promise<void> {
  await page.goto('/admin/login');
  await page.fill('[name="email"], input[type="email"]', STAFF_EMAIL);
  await page.fill('[name="password"], input[type="password"]', STAFF_PASS);
  await page.click('button[type="submit"]');
  // MFA step
  const totp = OTPAuth.authenticator.generate(TOTP_SECRET);
  await page.waitForSelector('[name="totp"], input[inputmode="numeric"]', { timeout: 5000 })
    .catch(() => null); // may auto-pass if MFA not required in test mode
  const mfaInput = page.locator('[name="totp"], input[inputmode="numeric"]').first();
  if (await mfaInput.isVisible()) {
    await mfaInput.fill(totp);
    await page.click('button[type="submit"]');
  }
  await page.waitForURL(/admin(?!\/login)/, { timeout: 10_000 });
}

/** Mock patient session for portal tests — sets the ns_patient_session cookie */
export async function setMockPatientSession(page: Page): Promise<void> {
  // The mock OIDC server accepts any code; we trigger the flow via /portal/login
  // In CI we intercept and inject a signed JWT directly via the API /mock-session endpoint.
  const mockJwt = process.env['TEST_PATIENT_JWT'];
  if (mockJwt) {
    await page.context().addCookies([{
      name:     'ns_patient_session',
      value:    mockJwt,
      domain:   new URL(process.env['APP_BASE_URL'] ?? 'http://localhost:3000').hostname,
      path:     '/',
      httpOnly: true,
      secure:   false,
    }]);
  }
}
