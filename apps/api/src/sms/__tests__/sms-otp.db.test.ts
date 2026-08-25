/**
 * SMS OTP flow — locks in the fix for the two bugs uncovered by
 * apps/web/e2e/sms-otp.spec.ts (SPEC 8):
 *
 *   1. GET /api/sms/last-otp always returned `{ code: null }`, even in
 *      console mode, because it read from the bcrypt-hashed DB column
 *      (irreversible) instead of a plaintext side-channel. Fixed by adding
 *      SmsService.getConsoleOtp(), backed by an in-memory cache populated
 *      only when SMS_PROVIDER=console.
 *   2. SmsService.verifyOtp() called bcrypt.compare(code, hash) without
 *      validating `code` was a string first. bcryptjs throws
 *      ("Illegal arguments: object, string") on a non-string input, which
 *      surfaced as an unhandled 500 (no `valid` key in the response) rather
 *      than a clean `{ valid: false }`. Fixed with an explicit type guard.
 *   3. POST /api/sms/otp accepted a `ttlOverrideMs` field in its DTO but
 *      never passed it to the service, so tests could never force a
 *      genuinely-expired OTP. Fixed by threading it through, honored only
 *      in console mode (dev/CI) — production TTL is always fixed at 10 min.
 *
 * REQUIRES: a real PostgreSQL instance with the SmsOtp/sms_otps table
 * migrated (DATABASE_URL). Run with the docker-compose postgres service up:
 *   pnpm --filter=@ns/api test -- sms-otp
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { SmsService } from '../sms.service';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

function uniquePhone(): string {
  return `+42190${Math.floor(1_000_000 + Math.random() * 8_000_000)}`;
}

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SmsService OTP flow (SMS_PROVIDER=console)', () => {
  const sms = new SmsService(new ConfigService({ SMS_PROVIDER: 'console' }));

  it('getConsoleOtp returns the real 6-digit plaintext code after sendOtp, and verifyOtp accepts it', async () => {
    const phone = uniquePhone();
    await sms.sendOtp(phone, 'test');

    const code = sms.getConsoleOtp(phone, 'test');
    expect(code).toMatch(/^\d{6}$/);

    const valid = await sms.verifyOtp(phone, code as string, 'test');
    expect(valid).toBe(true);

    // Second verify with the same (now-used) code must fail.
    const reused = await sms.verifyOtp(phone, code as string, 'test');
    expect(reused).toBe(false);
  });

  it('verifyOtp rejects a wrong code without throwing', async () => {
    const phone = uniquePhone();
    await sms.sendOtp(phone, 'test2');
    const valid = await sms.verifyOtp(phone, '000000', 'test2');
    expect(valid).toBe(false);
  });

  it('a ttlOverrideMs-forced expiry causes getConsoleOtp to return null and verifyOtp to return false — not throw', async () => {
    const phone = uniquePhone();
    await sms.sendOtp(phone, 'expired-test', 1); // 1ms TTL, console-mode only
    await new Promise((r) => setTimeout(r, 50));

    expect(sms.getConsoleOtp(phone, 'expired-test')).toBeNull();

    // Even if a caller passes null/undefined for `code` (mirroring what the
    // old buggy last-otp handler always returned), verifyOtp must resolve
    // to false rather than reject.
    await expect(
      sms.verifyOtp(phone, null as unknown as string, 'expired-test'),
    ).resolves.toBe(false);
    await expect(
      sms.verifyOtp(phone, undefined as unknown as string, 'expired-test'),
    ).resolves.toBe(false);
  });

  it('ttlOverrideMs is ignored outside console mode (production TTL stays fixed at 10 min)', async () => {
    // NestJS's ConfigService reads process.env directly (it's not limited to
    // the object passed to its constructor) — since apps/api/.env sets
    // SMS_PROVIDER=console for local dev/CI, that has to be overridden here
    // too, or `isConsole` would read 'console' regardless of what's passed
    // to `new ConfigService({...})`.
    const original = process.env['SMS_PROVIDER'];
    process.env['SMS_PROVIDER'] = 'gateway';
    try {
      const prodSms = new SmsService(new ConfigService({ SMS_PROVIDER: 'gateway' }));
      const phone = uniquePhone();
      await prodSms.sendOtp(phone, 'prod-test', 1); // should be ignored — real TTL is 10 min

      await new Promise((r) => setTimeout(r, 50));

      // getConsoleOtp is a no-op outside console mode.
      expect(prodSms.getConsoleOtp(phone, 'prod-test')).toBeNull();

      // The underlying DB row should still be within its (non-overridden)
      // 10-minute TTL — i.e. verifyOtp should still find *an* active row
      // rather than reporting expired, proving the override was ignored.
      const row = await prisma.smsOtp.findFirst({
        where: { phone, purpose: 'prod-test' },
        orderBy: { createdAt: 'desc' },
      });
      expect(row).not.toBeNull();
      expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 5 * 60 * 1000);
    } finally {
      process.env['SMS_PROVIDER'] = original;
    }
  });
});
