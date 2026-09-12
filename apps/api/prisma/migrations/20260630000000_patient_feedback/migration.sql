-- Sprint ROUTE-1b: satisfaction survey (anonymous) + complaints (PII, Act
-- No. 9/2010 — 30 working-day response SLA, administrator|super_admin read
-- only, every submission and staff read audit-logged).

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');

-- CreateTable
CREATE TABLE IF NOT EXISTS "satisfaction_survey_responses" (
    "id" TEXT NOT NULL,
    "clinic_name" TEXT NOT NULL,
    "visit_date" TIMESTAMPTZ,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfaction_survey_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "satisfaction_survey_responses_clinic_name_idx"
  ON "satisfaction_survey_responses" ("clinic_name");

-- CreateTable
CREATE TABLE IF NOT EXISTS "complaints" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT,
    "complaint_text" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'RECEIVED',
    "resolved_by_id" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "complaints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "complaints_status_idx" ON "complaints" ("status");
