-- Sprint WL9 — wearables §L9 compliance gate
--
-- Adds the support columns/enum value for the consent-grace suspension cron
-- (Part C). OAuth state (Part A) and the batch-alert digest (Part B) live in
-- Redis, so they need no schema. Huawei block (Part D) is config-only.

-- Consent-grace suspension: a new sync status the cron sets after 13 months
-- without a consent review. ADD VALUE is idempotent and safe to re-run.
ALTER TYPE "wearable_sync_status" ADD VALUE IF NOT EXISTS 'suspended';

-- Last time the patient reviewed/re-confirmed device consent. Null = never
-- reviewed; the 03:00 cron suspends sync for devices older than 13 months that
-- have never been reviewed (does NOT revoke OAuth tokens).
ALTER TABLE "wearable_devices"
  ADD COLUMN IF NOT EXISTS "last_consent_review" TIMESTAMPTZ;
