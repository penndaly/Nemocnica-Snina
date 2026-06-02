import { PrismaClient } from '@prisma/client';

export default async function globalTeardown() {
  if (!process.env['DATABASE_URL']) return;
  const prisma = new PrismaClient();
  await prisma.$connect();
  await prisma.booking.deleteMany({});
  await prisma.availabilitySlot.deleteMany({});
  await prisma.onboardingApplication.deleteMany({});
  await prisma.smsOtp.deleteMany({});
  await prisma.$disconnect();
}
