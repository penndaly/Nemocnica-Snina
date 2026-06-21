-- Sprint S7: add mode column to bookings and create booking_consents table

ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "mode" TEXT;

CREATE TABLE IF NOT EXISTS "booking_consents" (
  "id"          TEXT      NOT NULL DEFAULT gen_random_uuid()::text,
  "bookingId"   TEXT      NOT NULL,
  "consentType" TEXT      NOT NULL,
  "granted"     BOOLEAN   NOT NULL,
  "grantedAt"   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "booking_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_consents_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "booking_consents_bookingId_idx"
  ON "booking_consents"("bookingId");

-- App role: only INSERT + SELECT (append-only audit pattern)
-- REVOKE UPDATE, DELETE ON "booking_consents" FROM app_role;
