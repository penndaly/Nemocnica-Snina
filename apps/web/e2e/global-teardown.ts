import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  if (!process.env['DATABASE_URL']) return;
  const prisma = new PrismaClient();
  await prisma.$connect();
  // Same FK-safe ordering as global-setup.ts's wipe: telehealth_intake/
  // telehealth_summary -> telehealth_sessions and booking_consents ->
  // bookings are plain (non-cascading) FKs, so any row a test left behind
  // (TH-1.x's real booking submissions, telehealth.spec.ts's intake/
  // save-summary calls) makes booking.deleteMany() below fail with a
  // foreign-key violation. Delete leaf tables first.
  await prisma.telehealthSummary.deleteMany({});
  await prisma.telehealthIntake.deleteMany({});
  await prisma.telehealthSession.deleteMany({});
  await prisma.bookingConsent.deleteMany({});
  await prisma.booking.deleteMany({});
  await prisma.availabilitySlot.deleteMany({});
  await prisma.onboardingApplication.deleteMany({});
  await prisma.smsOtp.deleteMany({});
  await prisma.$disconnect();
}
