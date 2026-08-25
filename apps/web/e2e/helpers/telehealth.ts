/**
 * Telehealth E2E test helpers.
 *
 * Assumptions:
 * - TELEHEALTH_PROVIDER=mock in test environment (never real LiveKit in CI)
 * - The API exposes POST /api/test/telehealth/seed-session for CI fixture setup
 * - Mock eID session is set via TEST_PATIENT_JWT
 */
import { Page, APIRequestContext } from '@playwright/test';
import { setMockPatientSession } from './auth';

// 'fro' is the FRO *department* id (apps/web/src/lib/seed.ts's departments
// list) — the actual bookable, telehealth-enabled *clinic* (ambulancia) is
// a separate collection entry with its own id. Using the department id here
// made the wizard's ?mode=telehealth&clinic=fro deep-link match nothing,
// stranding every TH-1.x test on step 1.
export const TH_CLINIC_SLUG = 'fro-konzultacia'; // telehealth:true clinic tied to FRO

export interface SeedSessionResult {
  sessionId: string;
  bookingId: string;
  patientToken: string;
}

/**
 * Seed a test telehealth session via the CI fixture endpoint.
 * The endpoint is only available when NODE_ENV=test.
 */
export async function seedTelehealthSession(
  request: APIRequestContext,
  status: 'scheduled' | 'waiting' | 'active' | 'ended' = 'scheduled',
  withConsent = true,
): Promise<SeedSessionResult> {
  const apiUrl = process.env['API_BASE_URL'] ?? 'http://localhost:4000';
  const res = await request.post(`${apiUrl}/api/test/telehealth/seed-session`, {
    data: { clinicId: TH_CLINIC_SLUG, status, withConsent },
    headers: { 'X-Test-Secret': process.env['TEST_SECRET'] ?? 'ci-secret' },
  });
  if (!res.ok()) throw new Error(`seed-session failed: ${res.status()}`);
  return await res.json() as SeedSessionResult;
}

/** Navigate to the patient-side consultation room. */
export async function goToPatientRoom(page: Page, sessionId: string, lang = 'sk'): Promise<void> {
  await setMockPatientSession(page);
  await page.goto(`/${lang}/telehealth/konzultacia/${sessionId}`);
}

/**
 * Navigate to the physician-side consultation room and clear its step-up MFA
 * gate.
 *
 * The room itself requires a *second*, fresh TOTP entry on top of admin
 * login's own MFA — "Physician join requires MFA re-verify at the endpoint,
 * not just an active session" (CLAUDE.md non-negotiable) — so landing on the
 * URL alone leaves the page stuck on its `phase === 'mfa'` screen, before
 * any doctor-view UI (intake panel, Admit button) renders. In mock mode
 * (IS_MOCK in the room component, driven by
 * NEXT_PUBLIC_TELEHEALTH_PROVIDER=mock in CI) the code itself is never
 * actually checked server-side — any 6 digits clear the gate — so this
 * isn't reimplementing real MFA, just satisfying the client-side length
 * guard the same way a real physician's keystroke would.
 */
export async function goToPhysicianRoom(page: Page, sessionId: string, lang = 'sk'): Promise<void> {
  await page.goto(`/${lang}/telehealth/konzultacia/${sessionId}?role=physician`);
  const totpInput = page.locator('input[inputmode="numeric"]');
  await totpInput.waitFor({ state: 'visible', timeout: 8_000 });
  await totpInput.fill('123456');
  await totpInput.press('Enter');
  await totpInput.waitFor({ state: 'hidden', timeout: 8_000 }).catch(() => {});
}
