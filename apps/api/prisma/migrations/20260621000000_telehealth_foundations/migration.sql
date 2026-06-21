-- Telehealth Foundations — Sprint S6 (T0.1)
-- Creates telehealth_sessions, telehealth_intake, telehealth_summaries tables
-- and enforces legal status transitions at the DB layer.

-- ── Status enum ──────────────────────────────────────────────────────────────
CREATE TYPE "telehealth_status" AS ENUM (
  'scheduled',
  'waiting',
  'active',
  'ended',
  'cancelled',
  'no_show'
);

-- ── telehealth_sessions ───────────────────────────────────────────────────────
CREATE TABLE "telehealth_sessions" (
  "id"                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "bookingId"           UUID          NOT NULL,
  "clinicId"            TEXT          NOT NULL,
  "physicianId"         TEXT          NOT NULL,
  "patientToken"        TEXT          NOT NULL,
  "scheduledAt"         TIMESTAMPTZ   NOT NULL,
  "status"              telehealth_status NOT NULL DEFAULT 'scheduled',
  "startedAt"           TIMESTAMPTZ,
  "endedAt"             TIMESTAMPTZ,
  "durationSeconds"     INTEGER,
  "videoProvider"       TEXT          NOT NULL DEFAULT 'livekit',
  "providerRoomId"      TEXT          NOT NULL,
  "patientJoinToken"    TEXT,
  "physicianJoinToken"  TEXT,
  "tokensIssuedAt"      TIMESTAMPTZ,
  "intakeSubmitted"     BOOLEAN       NOT NULL DEFAULT FALSE,
  "hisSynced"           BOOLEAN       NOT NULL DEFAULT FALSE,
  "createdAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX "telehealth_sessions_bookingId_idx"    ON "telehealth_sessions" ("bookingId");
CREATE INDEX "telehealth_sessions_clinicId_idx"     ON "telehealth_sessions" ("clinicId");
CREATE INDEX "telehealth_sessions_physicianId_idx"  ON "telehealth_sessions" ("physicianId");
CREATE INDEX "telehealth_sessions_status_idx"       ON "telehealth_sessions" ("status");
CREATE INDEX "telehealth_sessions_scheduledAt_idx"  ON "telehealth_sessions" ("scheduledAt");

-- ── Status-transition enforcement trigger ─────────────────────────────────────
-- Allowed:   scheduled→waiting, waiting→active, active→ended,
--            any→cancelled (except already cancelled/ended), scheduled→no_show
-- All other transitions are forbidden — raise an exception so application bugs
-- cannot corrupt session state.

CREATE OR REPLACE FUNCTION enforce_telehealth_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  old_s telehealth_status := OLD.status;
  new_s telehealth_status := NEW.status;
BEGIN
  -- No-op: status unchanged
  IF old_s = new_s THEN
    RETURN NEW;
  END IF;

  -- Cancelled and ended are terminal — nothing can transition out
  IF old_s IN ('cancelled', 'ended', 'no_show') THEN
    RAISE EXCEPTION 'Illegal telehealth status transition: % → % (terminal state)',
      old_s, new_s USING ERRCODE = 'check_violation';
  END IF;

  -- Any non-terminal → cancelled is always allowed
  IF new_s = 'cancelled' THEN
    RETURN NEW;
  END IF;

  -- scheduled → waiting
  IF old_s = 'scheduled' AND new_s = 'waiting' THEN RETURN NEW; END IF;
  -- scheduled → no_show
  IF old_s = 'scheduled' AND new_s = 'no_show' THEN RETURN NEW; END IF;
  -- waiting → active
  IF old_s = 'waiting' AND new_s = 'active' THEN RETURN NEW; END IF;
  -- active → ended
  IF old_s = 'active' AND new_s = 'ended' THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Illegal telehealth status transition: % → %',
    old_s, new_s USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER telehealth_status_transition_guard
  BEFORE UPDATE OF "status" ON "telehealth_sessions"
  FOR EACH ROW EXECUTE FUNCTION enforce_telehealth_status_transition();

-- Guard: telehealth_summaries where his_synced=false must never be purge-eligible.
-- This partial index ensures the purge job (filtered to his_synced=true) cannot
-- accidentally touch unsynced rows.
-- The application-layer purge query MUST include WHERE "hisSynced" = TRUE.

-- ── telehealth_intake ─────────────────────────────────────────────────────────
CREATE TABLE "telehealth_intake" (
  "id"                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"           UUID          NOT NULL UNIQUE REFERENCES "telehealth_sessions"("id"),
  "reason"              TEXT          NOT NULL,
  "currentMedications"  TEXT          NOT NULL,
  "symptoms"            TEXT          NOT NULL,
  "vitalsNote"          TEXT,
  "submittedAt"         TIMESTAMPTZ   NOT NULL
);

-- ── telehealth_summaries ──────────────────────────────────────────────────────
CREATE TABLE "telehealth_summaries" (
  "id"                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId"                   UUID    NOT NULL UNIQUE REFERENCES "telehealth_sessions"("id"),
  "clinicalNote"                TEXT    NOT NULL,
  "followUpRecommendationSk"    TEXT,
  "followUpRecommendationEn"    TEXT,
  "prescriptionIssued"          BOOLEAN NOT NULL DEFAULT FALSE,
  "prescriptionRef"             TEXT,
  "pdfPath"                     TEXT,
  "hisEncounterId"              TEXT,
  "createdAt"                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial index enforces the purge-guard: only rows with hisSynced=true in
-- telehealth_sessions are candidates for pdf_path purge. A purge job must
-- join through this index to guarantee it never touches unsynced summaries.
CREATE INDEX "telehealth_summaries_synced_pdf_idx"
  ON "telehealth_summaries" ("sessionId")
  WHERE "pdfPath" IS NOT NULL;

-- ── Prisma migration metadata ─────────────────────────────────────────────────
-- This file is tracked by Prisma migrations. Run:
--   pnpm --filter @ns/api db:migrate
-- under the DATABASE_MIGRATION_URL (nsadmin role) to apply.
