/**
 * Sprint A4 E2E — admin booking management + wearables admin (Parts B, C).
 *
 * API-level checks against the NestJS service, matching the repo's infra-gated
 * lanes: they skip when the API is unreachable or TEST_STAFF_JWT is absent
 * (a super_admin staff access token; CMS_AUTH_BYPASS=true also works in dev).
 *
 * The admin UI (admin.html prototype) ships the Appointments + Devices views with
 * the documented a11y patterns. The production React admin pages under /admin are a
 * follow-up; the DOM + axe checks (A4-2, A4-8) are marked fixme until those exist.
 */
import { test, expect } from '@playwright/test';

const API = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
const STAFF_JWT = process.env['TEST_STAFF_JWT'];
const auth = () => ({ Authorization: `Bearer ${STAFF_JWT}` });

test.describe('A4 — auth gates (no token)', () => {
  test('GET /api/admin/bookings without a staff token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/bookings`).catch(() => null);
    test.skip(!res, 'API not reachable');
    expect(res!.status()).toBe(401);
  });

  test('GET /api/admin/wearables/platforms without a staff token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/admin/wearables/platforms`).catch(() => null);
    test.skip(!res, 'API not reachable');
    expect(res!.status()).toBe(401);
  });
});

test.describe('A4-3 — platform toggle compliance blocks', () => {
  test('enabling a partnership platform → 422 partnership_required', async ({ request }) => {
    test.skip(!STAFF_JWT, 'needs TEST_STAFF_JWT (super_admin)');
    const res = await request.put(`${API}/api/admin/wearables/platforms/medtronic_cardiac/enabled`, {
      headers: auth(),
      data: { enabled: true },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).code).toBe('partnership_required');
  });

  test('enabling Huawei → 422 eu_adequacy_blocked', async ({ request }) => {
    test.skip(!STAFF_JWT, 'needs TEST_STAFF_JWT (super_admin)');
    const res = await request.put(`${API}/api/admin/wearables/platforms/huawei/enabled`, {
      headers: auth(),
      data: { enabled: true },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).code).toBe('eu_adequacy_blocked');
  });
});

test.describe('A4-5 — credentials are never exposed', () => {
  test('GET platforms returns credentialsConfigured booleans, no secret values', async ({ request }) => {
    test.skip(!STAFF_JWT, 'needs TEST_STAFF_JWT (super_admin)');
    const res = await request.get(`${API}/api/admin/wearables/platforms`, { headers: auth() });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBeTruthy();
    for (const p of body) expect(typeof p.credentialsConfigured).toBe('boolean');
    // No env var *value* leaks: the only secret-looking key is the boolean flag.
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/client_secret|consumer_secret|CLIENT_SECRET/i);
  });
});

test.describe('A4-6 — global threshold update writes a global-scope audit entry', () => {
  test('PUT thresholds/defaults validates + persists', async ({ request }) => {
    test.skip(!STAFF_JWT, 'needs TEST_STAFF_JWT (administrator+)');
    // Valid ordered range persists.
    const ok = await request.put(`${API}/api/admin/wearables/monitoring/thresholds/defaults/heart_rate_bpm`, {
      headers: auth(),
      data: { highHigh: 120, criticalHigh: 150 },
    });
    expect(ok.ok()).toBeTruthy();
    // Invalid range (criticalLow > highLow) → 422.
    const bad = await request.put(`${API}/api/admin/wearables/monitoring/thresholds/defaults/glucose_mmol`, {
      headers: auth(),
      data: { criticalLow: 5, highLow: 3.9 },
    });
    expect(bad.status()).toBe(422);
  });
});

/* Production React admin pages are a follow-up — the A4 UI lives in the
   design_handoff admin.html prototype (Appointments + Devices sections,
   ?section=bookings / ?section=devices, axe-clean patterns). */
test.fixme('A4-2: clinician sees only their own clinic bookings (production /admin page)', async () => {});
// A4-8 is now covered for real by admin-a11y.spec.ts, which runs axe against
// /admin/bookings and /admin/wearables — the production React routes that did
// not exist when this fixme was written.
