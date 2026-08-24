/**
 * Admin login helper for E2E tests.
 * Uses the seeded test-clinician account + known TOTP secret.
 */
import { Page } from '@playwright/test';
import * as OTPAuth from 'otplib';
import { SignJWT } from 'jose';
import { PrismaClient } from '@prisma/client';

const STAFF_EMAIL  = process.env['TEST_STAFF_EMAIL']  ?? 'test-clinician@nemocnicasnina.sk';
const STAFF_PASS   = 'TestPass123!';
// Doubled from the classic 10-byte example secret ("JBSWY3DPEHPK3PXP") to
// 20 bytes: otplib v13's default guardrails reject anything under 16 bytes
// (SecretTooShortError) — see global-setup.ts, which seeds the same value.
const TOTP_SECRET  = process.env['TEST_TOTP_SECRET']  ?? 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

// Server-side single-use replay guard (apps/api/src/auth/staff-auth.service.ts
// verifyMfa: `if (lastTotpCounter !== null && totpCounter <= lastTotpCounter)
// throw 'MFA code already used'`) rejects a login whose TOTP code falls in the
// same (or an earlier) 30-second time-step as the account's last *successful*
// login — a real, correct anti-replay control, not something to weaken here.
// admin.spec.ts calls adminLogin() from multiple tests in the same worker,
// often under a second apart, so back-to-back calls legitimately regenerate
// the same time-based code and collide. A first attempt at fixing this by
// sleeping until the next 30s window worked in principle (no more "already
// used" errors) but each wait can take up to ~30s, and those waits compound
// across sequential tests — e.g. A5/A6 each burned ~30s waiting, leaving A7
// no headroom inside Playwright's 30s per-test timeout, which then failed on
// a plain step-level timeout instead. Waiting on real wall-clock time isn't
// viable here. Since each Playwright test represents a fresh login session
// (not a literal replay attack), reset the guard's counter directly before
// generating a code instead — deterministic, no waiting.
async function resetTotpReplayGuard(): Promise<void> {
  try {
    const prisma = new PrismaClient();
    await prisma.staffAccount.updateMany({
      where: { email: STAFF_EMAIL },
      data: { lastTotpCounter: null },
    });
    await prisma.$disconnect();
  } catch {
    // No DB reachable from this process, or the account isn't seeded yet —
    // fall through and let the login attempt itself surface the real error.
  }
}

export async function adminLogin(page: Page): Promise<void> {
  await resetTotpReplayGuard();
  await page.goto('/admin/login');
  await page.fill('[name="email"], input[type="email"]', STAFF_EMAIL);
  await page.fill('[name="password"], input[type="password"]', STAFF_PASS);
  await page.click('button[type="submit"]');
  // MFA step
  // otplib v13 (installed: 13.4.1) is a full rewrite — there is no
  // `authenticator` singleton anymore (that was the v11/v12 API). Named
  // exports are now flat top-level functions; `generate` is async and takes
  // a single options object. See apps/api/src/auth/staff-auth.service.ts,
  // which had the same stale-API bug in production MFA verify/setup code.
  const totp = await OTPAuth.generate({ secret: TOTP_SECRET });
  await page.waitForSelector('[name="totp"], input[inputmode="numeric"]', { timeout: 5000 })
    .catch(() => null); // may auto-pass if MFA not required in test mode
  const mfaInput = page.locator('[name="totp"], input[inputmode="numeric"]').first();
  if (await mfaInput.isVisible()) {
    await mfaInput.fill(totp);
    await page.click('button[type="submit"]');
  }
  await page.waitForURL(/admin(?!\/login)/, { timeout: 10_000 });
}

// Mirrors apps/web/src/lib/session-secret.ts's secret resolution exactly —
// duplicated (not imported) so this helper stays a self-contained Node
// script Playwright can load without resolving the app's `@/*` tsconfig
// path aliases. Keep these two in sync if either changes.
const PATIENT_AUDIENCE = 'ns.patient';
function resolvePatientSessionSecret(): Uint8Array {
  const s = process.env['JWT_SECRET'];
  const secret = s && s.length >= 32 ? s : 'dev-secret-min-32-chars-long-xxx';
  return new TextEncoder().encode(secret);
}

/**
 * Mock patient session for portal tests — sets the ns_patient_session cookie.
 *
 * Previously this read a `TEST_PATIENT_JWT` env var that nothing in the repo
 * ever set (not CI, not global-setup.ts) — every "authenticated" portal test
 * was silently running unauthenticated. The web app (apps/web/src/app/[lang]/
 * portal/callback/route.ts) mints its own session JWT with `jose` using
 * JWT_SECRET (or a well-known dev fallback outside production) and an
 * `ns.patient` audience claim, verified by /api/portal/me. Sign one here the
 * same way instead of depending on an out-of-band token nobody produces.
 */
export async function setMockPatientSession(page: Page): Promise<void> {
  const mockJwt = process.env['TEST_PATIENT_JWT'] ?? await new SignJWT({
    sub:  'e2e-test-patient',
    name: 'Test Pacient',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setAudience(PATIENT_AUDIENCE)
    .setExpirationTime('30m')
    .sign(resolvePatientSessionSecret());

  await page.context().addCookies([{
    name:     'ns_patient_session',
    value:    mockJwt,
    domain:   new URL(process.env['APP_BASE_URL'] ?? 'http://localhost:3000').hostname,
    path:     '/',
    httpOnly: true,
    secure:   false,
  }]);
}
