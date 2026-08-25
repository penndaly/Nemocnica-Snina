/**
 * Global setup — runs once before all Playwright tests.
 * Resets booking/onboarding tables and seeds test fixtures.
 * Requires DATABASE_URL to point at the test database.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID, randomBytes, createCipheriv } from 'crypto';
import { SignJWT } from 'jose';
import { toLocalDateString } from './helpers/booking';

// Must match apps/api/src/telehealth/telehealth-session.service.ts's
// E2E_TEST_PHYSICIAN_ID — the fixed physician identity the seed-session
// fixture endpoint assigns, so TEST_STAFF_JWT's sub matches session
// ownership checks (admitPatient/endSession/cancelSession/submitIntake).
const E2E_TEST_PHYSICIAN_ID = 'e2e-physician-1';

export default async function globalSetup() {
  if (!process.env['DATABASE_URL']) return; // skip if no DB

  const prisma = new PrismaClient();
  await prisma.$connect();

  // Wipe test-generated data (keep content tables untouched), in FK-safe
  // order. telehealth_sessions -> bookings is ON DELETE CASCADE, but
  // telehealth_intake/telehealth_summary -> telehealth_sessions and
  // booking_consents -> bookings are plain (non-cascading) FKs — leftover
  // rows from a prior run's telehealth.spec.ts (intake/save-summary) or any
  // booking consent would make the cascade from booking.deleteMany() below
  // fail with a foreign key violation. Delete leaf tables first.
  await prisma.telehealthSummary.deleteMany({});
  await prisma.telehealthIntake.deleteMany({});
  await prisma.telehealthSession.deleteMany({});
  await prisma.bookingConsent.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.availabilitySlot.deleteMany({});
  await prisma.onboardingApplication.deleteMany({});
  await prisma.smsOtp.deleteMany({});

  // Seed availability slots for happy-path tests. There is no server-clock
  // mocking in this suite, so dates are computed relative to the real
  // current date rather than hardcoded — a fixed past date would drift and
  // trip booking-rules.service.ts's (correct) past-date guard instead of
  // the rule the test actually targets.
  //
  // This process (global-setup.ts) runs in Node on the CI runner, which is
  // UTC — but the wizard's own date list (getNextAllowedDates in
  // objednanie/page.tsx) runs in the browser, which playwright.config.ts
  // pins to Europe/Bratislava. Near midnight UTC (~1-2am Bratislava) the two
  // can disagree about what "today" is, which is enough to shift which
  // weekday's occurrence counts as "next" — seeding just the Nth-next
  // occurrence of one specific weekday isn't robust to that. Seeding every
  // matching weekday across a wide multi-day window is: whichever date the
  // browser's clock actually picks as nearest, a slot exists for it either
  // way.
  function nextBookableDates(bookingDays: readonly number[], windowDays = 12): string[] {
    const dates: string[] = [];
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    for (let i = 1; i <= windowDays; i++) {
      cursor.setDate(cursor.getDate() + 1);
      if (bookingDays.includes(cursor.getDay())) {
        dates.push(toLocalDateString(cursor));
      }
    }
    return dates;
  }

  // The wizard's step-3 time buttons are generated purely client-side
  // (generateSlots() in objednanie/page.tsx), from clinic.bookingWindow (or
  // clinic.telehealthWindow in ?mode=telehealth) when set, else every 20
  // minutes from 08:00 — the "click .first()" tests always get whichever of
  // those the clinic uses, never whatever time happens to be seeded here
  // unless it's made to match.
  const clinicSlots = [
    // Urology: bookable every weekday (seed.ts: [1,2,3,4,5]), no bookingWindow.
    ...nextBookableDates([1, 2, 3, 4, 5]).flatMap((date) => [
      { clinicId: 'urologicka', date, time: '08:00' },
      { clinicId: 'urologicka', date, time: '08:20' },
      { clinicId: 'urologicka', date, time: '08:40' },
    ]),
    // Trauma surgery: Tue/Thu, no bookingWindow.
    ...nextBookableDates([2, 4]).flatMap((date) => [
      { clinicId: 'urazova-chirurgia', date, time: '08:00' },
    ]),
    // Angiology: Thu, bookingWindow 13:00–14:00.
    ...nextBookableDates([4]).flatMap((date) => [
      { clinicId: 'angiologicka', date, time: '13:00' },
      { clinicId: 'angiologicka', date, time: '13:20' },
    ]),
    // FRO video consultation (telehealth.spec.ts's TH_CLINIC): Mon/Wed/Fri,
    // telehealthWindow 10:00–12:00.
    ...nextBookableDates([1, 3, 5]).flatMap((date) => [
      { clinicId: 'fro-konzultacia', date, time: '10:00' },
      { clinicId: 'fro-konzultacia', date, time: '10:20' },
    ]),
  ];

  for (const slot of clinicSlots) {
    await prisma.availabilitySlot.create({
      data: { id: randomUUID(), ...slot, booked: false },
    });
  }

  // Seed a test staff user (clinician) with known TOTP secret for admin tests
  //
  // bcryptjs is CommonJS; dynamic import() of a CJS module from this ESM
  // context wraps its exports under `.default` in this bundling
  // environment (Playwright's esbuild transform) rather than exposing them
  // directly on the module namespace object — bcrypt.hash was undefined.
  // Fall back to the namespace object itself in case that's ever untrue.
  const bcryptModule = await import('bcryptjs');
  const bcrypt = bcryptModule.default ?? bcryptModule;
  // Doubled from the classic 10-byte example secret ("JBSWY3DPEHPK3PXP"):
  // otplib v13 (installed: 13.4.1) enforces a 16-byte-minimum guardrail on
  // TOTP secrets (SecretTooShortError below that), which the old 10-byte
  // value trips on `generate`/`verify`. helpers/auth.ts uses this same
  // literal via TEST_TOTP_SECRET.
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'; // well-known test TOTP secret (20 bytes)
  process.env['TEST_TOTP_SECRET'] = secret;
  process.env['TEST_STAFF_EMAIL'] = 'test-clinician@nemocnicasnina.sk';

  const existingUser = await prisma.staffUser.findUnique({
    where: { email: 'test-clinician@nemocnicasnina.sk' },
  });
  if (!existingUser) {
    await prisma.staffUser.create({
      data: {
        id:           randomUUID(),
        email:        'test-clinician@nemocnicasnina.sk',
        name:         'Test Clinician',
        passwordHash: await bcrypt.hash('TestPass123!', 10),
        role:         'CLINICIAN',
        mfaEnabled:   true,
        mfaSecret:    secret,
        active:       true,
      },
    });
  }

  // Also seed the NEWER `StaffAccount` model (apps/api/prisma/schema.prisma).
  //
  // The `StaffUser` row above is the LEGACY model, queried only by the
  // legacy `AuthController`/`AuthService` (`POST /api/auth/login`,
  // `AuthGuard('jwt')`). The admin web login page
  // (apps/web/src/app/admin/login/page.tsx via AdminAuthContext.login) does
  // NOT call that endpoint — it calls the newer two-step
  // `StaffAuthController`/`StaffAuthService` (`POST /api/auth/staff/login`
  // then `POST /api/auth/staff/verify-mfa`), which looks the account up in
  // `prisma.staffAccount`, not `prisma.staffUser`. Without this block every
  // admin.spec.ts test was authenticating against a row the live login flow
  // never queries — the seeded StaffUser was a red herring.
  //
  // `StaffAccount.totpSecret` is AES-256-GCM ciphertext at rest (never
  // plaintext — see apps/api/src/auth/staff-totp-crypto.service.ts), so it
  // must be encrypted here with the same STAFF_TOTP_KEY the API process
  // uses (mirrors StaffTotpCryptoService.encrypt: base64(iv(12)|tag(16)|ct)).
  // Falls back to the all-zero dev default from
  // apps/api/src/config/config.schema.ts's hexSecret() when STAFF_TOTP_KEY
  // isn't set in the environment (local dev); CI sets it explicitly and that
  // value is inherited here since global-setup runs inside the same job.
  const staffTotpKeyHex = process.env['STAFF_TOTP_KEY'] ?? '0'.repeat(64);
  function encryptTotpSecret(plaintext: string): string {
    const key = Buffer.from(staffTotpKeyHex, 'hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  const existingAccount = await prisma.staffAccount.findUnique({
    where: { email: 'test-clinician@nemocnicasnina.sk' },
  });
  const clinicianAccountId = existingAccount?.id ?? randomUUID();
  if (!existingAccount) {
    await prisma.staffAccount.create({
      data: {
        id:            clinicianAccountId,
        email:         'test-clinician@nemocnicasnina.sk',
        name:          'Test Clinician',
        role:          'clinician',
        passwordHash:  await bcrypt.hash('TestPass123!', 10),
        totpSecret:    encryptTotpSecret(secret),
        totpEnabled:   true,
        recoveryCodes: [],
        status:        'active',
      },
    });
  }

  // Separate super_admin fixture account for admin-a4.spec.ts's wearables
  // platform-management tests (WearablesAdminController requires exactly
  // 'super_admin'; WearablesMonitoringController accepts 'administrator' or
  // 'super_admin' too). Deliberately its own account/JWT, not an upgrade of
  // the clinician fixture above — reusing one identity across role tiers
  // would stop exercising StaffRolesGuard's actual role check.
  const existingSuperAdmin = await prisma.staffAccount.findUnique({
    where: { email: 'test-superadmin@nemocnicasnina.sk' },
  });
  const superAdminAccountId = existingSuperAdmin?.id ?? randomUUID();
  if (!existingSuperAdmin) {
    await prisma.staffAccount.create({
      data: {
        id:            superAdminAccountId,
        email:         'test-superadmin@nemocnicasnina.sk',
        name:          'Test Super Admin',
        role:          'super_admin',
        passwordHash:  await bcrypt.hash('TestPass123!', 10),
        totpSecret:    encryptTotpSecret(secret),
        totpEnabled:   true,
        recoveryCodes: [],
        status:        'active',
      },
    });
  }

  // Sign TEST_PATIENT_JWT / TEST_STAFF_JWT for the telehealth + portal E2E
  // specs. These back Authorization: Bearer headers the tests send directly
  // to the API (apps/api/src/auth/jwt.strategy.ts accepts aud 'ns.patient'
  // or 'ns.staff.legacy' signed with the same JWT_SECRET this API process
  // boots with). Env vars set here in globalSetup are inherited by the
  // worker processes Playwright spawns afterward.
  const jwtSecret = process.env['JWT_SECRET'];
  if (jwtSecret) {
    const key = new TextEncoder().encode(jwtSecret);

    process.env['TEST_PATIENT_JWT'] = await new SignJWT({
      email: 'e2e-patient@nemocnicasnina.sk',
      role: 'PATIENT',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('e2e-patient-1')
      .setAudience('ns.patient')
      .setExpirationTime('4h')
      .sign(key);

    process.env['TEST_STAFF_JWT'] = await new SignJWT({
      email: process.env['TEST_STAFF_EMAIL'] ?? 'test-clinician@nemocnicasnina.sk',
      role: 'CLINICIAN',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(E2E_TEST_PHYSICIAN_ID)
      .setAudience('ns.staff.legacy')
      .setExpirationTime('4h')
      .sign(key);
  }

  // TEST_SUPERADMIN_JWT — a real StaffJwtGuard-verifiable access token for
  // the super_admin fixture account above. This is a DIFFERENT auth system
  // from TEST_STAFF_JWT's (STAFF_JWT_SECRET + aud 'ns.staff' + typ 'access',
  // verified by apps/api/src/auth/staff-jwt.guard.ts's StaffJwtGuard against
  // a real staff_accounts row — not JWT_SECRET + aud 'ns.staff.legacy',
  // verified by the older passport JwtStrategy). Payload shape mirrors
  // StaffAuthService.issueSession() exactly: { sub, email, role, scopes,
  // jti, typ }.
  const staffJwtSecret = process.env['STAFF_JWT_SECRET'];
  if (staffJwtSecret) {
    const staffKey = new TextEncoder().encode(staffJwtSecret);
    process.env['TEST_SUPERADMIN_JWT'] = await new SignJWT({
      email: 'test-superadmin@nemocnicasnina.sk',
      role: 'super_admin',
      scopes: [],
      jti: randomUUID(),
      typ: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(superAdminAccountId)
      .setAudience('ns.staff')
      .setExpirationTime('4h')
      .sign(staffKey);
  }

  await prisma.$disconnect();
}
