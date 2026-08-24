-- Real DDL for the tables that were originally created outside Prisma
-- migration history (via `db push` at Phase 0 / Sprint S3, before
-- prisma/migrations/ existed): bookings, availability_slots,
-- onboarding_applications, staff_users, audit_log, sms_otps, payment_receipts.
--
-- 0001_baseline is an empty marker file — rewriting it would change its
-- checksum and break every environment that already ran
-- `migrate resolve --applied 0001_baseline` against the empty version. This
-- migration is additive instead: on a truly empty database, `migrate deploy`
-- now builds the full schema through 0001_baseline (no-op) -> this file (real
-- DDL) -> the existing chain (which ALTERs these tables, e.g. `bookings` gets
-- its `mode` column and `booking_consents` FK in
-- 20260621100000_telehealth_booking_s7). On an already-baselined DB, these
-- tables already exist from the historical `db push`, so every statement here
-- is guarded to no-op rather than error — provision-db.sh's baselining path
-- for existing/staging DBs is untouched by this file.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StaffRole" AS ENUM ('EDITOR', 'CLINICIAN', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "availability_slots" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "booked" BOOLEAN NOT NULL DEFAULT false,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "bookings" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientPhone" TEXT NOT NULL,
    "patientRcHash" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "hasReferral" BOOLEAN NOT NULL DEFAULT false,
    "gdprConsent" BOOLEAN NOT NULL DEFAULT false,
    "referralConsent" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "cancelToken" TEXT NOT NULL,
    "smsVerified" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "onboarding_applications" (
    "id" TEXT NOT NULL,
    "physicianId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientRcHash" TEXT NOT NULL,
    "insurerCode" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "ncziXmlPayload" TEXT,
    "signToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "staff_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'EDITOR',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecret" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "detail" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sms_otps" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_receipts" (
    "id" TEXT NOT NULL,
    "transactionRef" TEXT NOT NULL,
    "bookingId" TEXT,
    "pdfContent" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "availability_slots_bookingId_key" ON "availability_slots"("bookingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "availability_slots_clinicId_date_idx" ON "availability_slots"("clinicId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_cancelToken_key" ON "bookings"("cancelToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_clinicId_date_idx" ON "bookings"("clinicId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bookings_cancelToken_idx" ON "bookings"("cancelToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "onboarding_applications_signToken_key" ON "onboarding_applications"("signToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "onboarding_applications_physicianId_status_idx" ON "onboarding_applications"("physicianId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "staff_users_email_key" ON "staff_users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_resource_resourceId_idx" ON "audit_log"("resource", "resourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_actorEmail_idx" ON "audit_log"("actorEmail");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "sms_otps_phone_purpose_idx" ON "sms_otps"("phone", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payment_receipts_transactionRef_key" ON "payment_receipts"("transactionRef");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_receipts_bookingId_idx" ON "payment_receipts"("bookingId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "staff_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
