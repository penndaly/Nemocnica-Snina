-- QA security: bind payment receipts to the owning portal patient so the portal
-- receipt list/download can be filtered (was: any patient could list/download all
-- receipts). Null = anonymous booking-flow payment (not portal-listable).
ALTER TABLE "payment_receipts"
  ADD COLUMN IF NOT EXISTS "patient_token" TEXT;

CREATE INDEX IF NOT EXISTS "payment_receipts_patient_token_idx"
  ON "payment_receipts" ("patient_token");
