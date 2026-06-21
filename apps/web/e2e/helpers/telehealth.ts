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

export const TH_CLINIC_SLUG = 'fro'; // FRO is the TH-Pilot clinic; telehealth:true

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

/** Navigate to the physician-side consultation room. */
export async function goToPhysicianRoom(page: Page, sessionId: string, lang = 'sk'): Promise<void> {
  await page.goto(`/${lang}/telehealth/konzultacia/${sessionId}?role=physician`);
}
