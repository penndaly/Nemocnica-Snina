/**
 * Wearables compliance E2E (Sprint W6 — WR-5, WR-7, webhook, isolation).
 *
 * API-level checks against the NestJS service. They skip when the API is not
 * reachable / TEST_PATIENT_JWT is absent, matching the repo's infra-gated lanes.
 */
import { test, expect } from '@playwright/test';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const PATIENT_JWT = process.env['TEST_PATIENT_JWT'];

test.describe('WR-W6 — compliance', () => {
  test('WR-7: forged OAuth state on the callback → 400 INVALID_OAUTH_STATE', async ({ request }) => {
    const res = await request.get(`${API}/api/wearables/callback/fitbit?code=x&state=forged-not-issued`, { maxRedirects: 0 }).catch(() => null);
    test.skip(!res, 'API not reachable');
    expect(res!.status()).toBe(400);
  });

  test('webhook: tampered/unsigned Garmin payload → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/wearables/webhooks/garmin`, {
      data: { userId: 'u1', readings: [] },
      headers: { 'x-garmin-signature': 'deadbeef' },
    }).catch(() => null);
    test.skip(!res, 'API not reachable');
    expect(res!.status()).toBe(401);
  });

  test('WR-5: cross-patient reading access is rejected (403)', async ({ request }) => {
    test.skip(!PATIENT_JWT, 'needs TEST_PATIENT_JWT');
    const res = await request.get(`${API}/api/wearables/devices/00000000-0000-0000-0000-000000000000/readings`, {
      headers: { 'x-patient-session': PATIENT_JWT! },
    });
    // No data_storage consent for another patient's device → ConsentGuard 403.
    expect(res.status()).toBe(403);
  });
});
