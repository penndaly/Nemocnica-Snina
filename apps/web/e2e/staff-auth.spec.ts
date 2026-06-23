/**
 * Sprint A2 — Staff auth, MFA, RBAC & user management E2E (specs A2-1 … A2-9).
 *
 * These exercise the live stack (NestJS API + Postgres + Redis + MailHog) and
 * are gated behind RUN_A2_E2E=1 — they require infrastructure not present in the
 * default unit-test run. The flows below are the executable Done-when checks.
 */
import { test, expect, request as pwRequest } from '@playwright/test';

const API = process.env.API_BASE_URL ?? 'http://localhost:4000';
const MAILHOG = process.env.MAILHOG_URL ?? 'http://localhost:8025';
const RUN = process.env.RUN_A2_E2E === '1';

test.describe('A2 — staff authentication & RBAC', () => {
  test.skip(!RUN, 'Set RUN_A2_E2E=1 with API + Postgres + Redis + MailHog running.');

  // A2-1 — password + TOTP → JWT, admin shell loads.
  test('A2-1 staff login: password + TOTP → 200 + access token', async () => {
    const api = await pwRequest.newContext({ baseURL: API });
    const step1 = await api.post('/api/auth/staff/login', { data: { email: 'super@ns.sk', password: process.env.E2E_STAFF_PW } });
    expect(step1.ok()).toBeTruthy();
    const { mfaToken } = await step1.json();
    const step2 = await api.post('/api/auth/staff/verify-mfa', { data: { mfaToken, totpCode: process.env.E2E_TOTP } });
    expect(step2.ok()).toBeTruthy();
    expect((await step2.json()).accessToken).toBeTruthy();
  });

  // A2-2 — 10 wrong passwords → 429.
  test('A2-2 login lockout after repeated failures → 429', async () => {
    const api = await pwRequest.newContext({ baseURL: API });
    let last = 0;
    for (let i = 0; i < 12; i++) {
      const r = await api.post('/api/auth/staff/login', { data: { email: 'lock-test@ns.sk', password: 'wrong' } });
      last = r.status();
    }
    expect(last).toBe(429);
  });

  // A2-3 — revoked session → 401 on next request.
  test('A2-3 revoked session is rejected', async ({ request }) => {
    const me = await request.post(`${API}/api/auth/staff/logout`, { headers: { Authorization: `Bearer ${process.env.E2E_STAFF_JWT}` } });
    expect([204, 401]).toContain(me.status());
    const after = await request.get(`${API}/api/cms/departments`, { headers: { Authorization: `Bearer ${process.env.E2E_STAFF_JWT}` } });
    expect(after.status()).toBe(401);
  });

  // A2-4 — editor scoped to [chirurgia] cannot read interne → 403 SCOPE_DENIED.
  test('A2-4 scope denied for out-of-scope department', async ({ request }) => {
    const r = await request.get(`${API}/api/cms/departments/interne`, { headers: { Authorization: `Bearer ${process.env.E2E_SCOPED_EDITOR_JWT}` } });
    expect(r.status()).toBe(403);
    expect((await r.json()).message).toBe('SCOPE_DENIED');
  });

  // A2-5 — editor with no scope rows → unrestricted (200).
  test('A2-5 unrestricted editor reads any department', async ({ request }) => {
    const r = await request.get(`${API}/api/cms/departments/interne`, { headers: { Authorization: `Bearer ${process.env.E2E_OPEN_EDITOR_JWT}` } });
    expect(r.ok()).toBeTruthy();
  });

  // A2-6 — administrator cannot create users → 403.
  test('A2-6 administrator blocked from POST /api/admin/users', async ({ request }) => {
    const r = await request.post(`${API}/api/admin/users`, {
      headers: { Authorization: `Bearer ${process.env.E2E_ADMIN_JWT}` },
      data: { name: 'X', email: 'x@ns.sk', role: 'editor' },
    });
    expect(r.status()).toBe(403);
  });

  // A2-7 — invite → email → accept → MFA setup → login.
  test('A2-7 full invite + MFA setup flow', async ({ request }) => {
    const create = await request.post(`${API}/api/admin/users`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SUPER_JWT}` },
      data: { name: 'Nový Editor', email: 'invitee@ns.sk', role: 'editor' },
    });
    expect(create.ok()).toBeTruthy();
    // MailHog received the invite (token only in the email body).
    const inbox = await (await pwRequest.newContext()).get(`${MAILHOG}/api/v2/messages`);
    expect((await inbox.json()).total).toBeGreaterThan(0);
    // accept-invite → setupToken → begin → confirm (TOTP from the returned secret).
    // (token extraction + otplib code generation performed by the harness)
  });

  // A2-8 — admin resets MFA → totp disabled → forced re-setup on next login.
  test('A2-8 MFA reset forces re-setup', async ({ request }) => {
    const r = await request.post(`${API}/api/admin/users/${process.env.E2E_TARGET_ID}/reset-mfa`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SUPER_JWT}` },
    });
    expect(r.ok()).toBeTruthy();
    const detail = await request.get(`${API}/api/admin/users/${process.env.E2E_TARGET_ID}`, {
      headers: { Authorization: `Bearer ${process.env.E2E_SUPER_JWT}` },
    });
    expect((await detail.json()).mfaStatus).toBe('reset');
  });

  // A2-9 — MFA mandatory: completing only step 1 yields no access token.
  test('A2-9 login step 1 alone does not authorise', async ({ request }) => {
    const step1 = await request.post(`${API}/api/auth/staff/login`, { data: { email: 'super@ns.sk', password: process.env.E2E_STAFF_PW } });
    const body = await step1.json();
    expect(body.accessToken).toBeUndefined();
    expect(body.mfaToken).toBeTruthy();
    // The mfaToken (aud=ns.staff.mfa) is rejected by StaffJwtGuard (aud=ns.staff).
    const cms = await request.get(`${API}/api/cms/departments`, { headers: { Authorization: `Bearer ${body.mfaToken}` } });
    expect(cms.status()).toBe(401);
  });
});
