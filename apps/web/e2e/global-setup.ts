/**
 * Global setup — runs once before all Playwright tests.
 * Resets booking/onboarding tables and seeds test fixtures.
 * Requires DATABASE_URL to point at the test database.
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

// Fixed Monday for deterministic weekday rule assertions
export const TEST_NOW = new Date('2026-06-08T08:00:00+02:00');
// Tuesday 2026-06-09 and Thursday 2026-06-11 for clinic-specific tests
export const NEXT_TUESDAY   = '2026-06-09';
export const NEXT_THURSDAY  = '2026-06-11';
export const NEXT_WEDNESDAY = '2026-06-10';

export default async function globalSetup() {
  if (!process.env['DATABASE_URL']) return; // skip if no DB

  const prisma = new PrismaClient();
  await prisma.$connect();

  // Wipe test-generated data (keep content tables untouched)
  await prisma.booking.deleteMany({});
  await prisma.availabilitySlot.deleteMany({});
  await prisma.onboardingApplication.deleteMany({});
  await prisma.smsOtp.deleteMany({});

  // Seed availability slots for happy-path tests
  const clinicSlots = [
    // Urology: Mon–Fri slots next week
    { clinicId: 'urologicka', date: '2026-06-09', time: '09:00' },
    { clinicId: 'urologicka', date: '2026-06-09', time: '09:20' },
    { clinicId: 'urologicka', date: '2026-06-09', time: '09:40' },
    // Trauma surgery: Tue/Thu
    { clinicId: 'urazova-chirurgia', date: NEXT_TUESDAY,  time: '09:00' },
    { clinicId: 'urazova-chirurgia', date: NEXT_THURSDAY, time: '09:00' },
    // Angiology: Thu 13:00–14:00
    { clinicId: 'angiologicka', date: NEXT_THURSDAY, time: '13:00' },
    { clinicId: 'angiologicka', date: NEXT_THURSDAY, time: '13:20' },
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
  const secret = 'JBSWY3DPEHPK3PXP'; // well-known test TOTP secret
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

  await prisma.$disconnect();
}
