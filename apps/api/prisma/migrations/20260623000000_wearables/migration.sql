-- Wearables & Remote Monitoring — Sprint W1 (Data Model + Consent Engine)
-- Creates the wearable device, readings, consent, alert-threshold and sync-job
-- tables. No patient identity is stored here — only the opaque patient_token
-- (eID-derived), mirroring telehealth_sessions.
--
-- Compliance notes (see SPRINT_BACKLOG_WEARABLES.md §"Non-negotiables"):
--   • OAuth tokens stored AES-256-GCM encrypted (oauth_*_token_enc columns).
--   • FHIR-synced readings are immutable: never UPDATE/DELETE a row whose
--     fhir_observation_id is set; add a superseded_by pointer instead.
--   • Consent withdrawal soft-deletes un-synced readings only.

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "wearable_platforms" AS ENUM (
  'abbott_libre',
  'dexcom',
  'medtronic_cgm',
  'medtronic_cardiac',
  'abbott_cardiac',
  'boston_scientific',
  'alivecor',
  'withings',
  'omron',
  'apple_health',
  'google_health',
  'samsung_health',
  'fitbit',
  'garmin',
  'huawei',
  'xiaomi',
  'meta'
);

CREATE TYPE "wearable_category" AS ENUM ('medical', 'consumer');

CREATE TYPE "device_type" AS ENUM (
  'cgm',
  'pacemaker',
  'ecg',
  'bp',
  'smartwatch',
  'fitness',
  'hybrid',
  'other'
);

CREATE TYPE "wearable_sync_status" AS ENUM ('ok', 'error', 'pending', 'revoked');

CREATE TYPE "reading_flag" AS ENUM ('normal', 'high', 'low', 'critical', 'info');

-- ── wearable_devices ──────────────────────────────────────────────────────────

CREATE TABLE "wearable_devices" (
  "id"                       UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_token"            TEXT                  NOT NULL,   -- opaque eID token, NOT an RC
  "platform"                 "wearable_platforms"  NOT NULL,
  "device_label"             TEXT                  NOT NULL,   -- user-visible e.g. "FreeStyle Libre 3"
  "category"                 "wearable_category"   NOT NULL,
  "device_type"              "device_type"         NOT NULL,
  "oauth_access_token_enc"   TEXT,                             -- AES-256-GCM ciphertext
  "oauth_refresh_token_enc"  TEXT,                             -- AES-256-GCM ciphertext
  "oauth_expires_at"         TIMESTAMPTZ,
  "share_with_physician"     BOOLEAN               NOT NULL DEFAULT TRUE,
  "last_sync_at"             TIMESTAMPTZ,
  "sync_status"              "wearable_sync_status" NOT NULL DEFAULT 'pending',
  "sync_error"               TEXT,
  "partnership_required"     BOOLEAN               NOT NULL DEFAULT FALSE,  -- cardiac implants
  "connected_at"             TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  "disconnected_at"          TIMESTAMPTZ,
  "created_at"               TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX "wearable_devices_patient_token_idx" ON "wearable_devices" ("patient_token");
CREATE INDEX "wearable_devices_platform_idx"      ON "wearable_devices" ("platform");
CREATE INDEX "wearable_devices_sync_status_idx"   ON "wearable_devices" ("sync_status");

-- ── device_readings ───────────────────────────────────────────────────────────
-- Immutable once fhir_observation_id is set. superseded_by replaces a row
-- without deleting it.

CREATE TABLE "device_readings" (
  "id"                   UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  "device_id"            UUID            NOT NULL REFERENCES "wearable_devices"("id"),
  "patient_token"        TEXT            NOT NULL,            -- denormalized for query speed
  "metric_type"          TEXT            NOT NULL,            -- LOINC code string e.g. '14745-4'
  "metric_label"         JSONB           NOT NULL,            -- {sk,en} bilingual display name
  "value_numeric"        NUMERIC(12,4),
  "value_text"           TEXT,
  "unit"                 TEXT            NOT NULL DEFAULT '',
  "flag"                 "reading_flag"  NOT NULL DEFAULT 'normal',
  "recorded_at"          TIMESTAMPTZ     NOT NULL,            -- device timestamp
  "received_at"          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  "fhir_observation_id"  TEXT,                                -- set after HIS export; immutable
  "superseded_by"        UUID            REFERENCES "device_readings"("id"),
  "created_at"           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_dr_device_recorded"  ON "device_readings" ("device_id", "recorded_at" DESC);
CREATE INDEX "idx_dr_patient_recorded" ON "device_readings" ("patient_token", "recorded_at" DESC);

-- ── device_consent ────────────────────────────────────────────────────────────

CREATE TABLE "device_consent" (
  "id"             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_token"  TEXT         NOT NULL,
  "device_id"      UUID         NOT NULL REFERENCES "wearable_devices"("id"),
  "consent_type"   TEXT         NOT NULL,   -- 'data_storage' | 'physician_sharing' | 'his_export'
  "granted"        BOOLEAN      NOT NULL,
  "granted_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "withdrawn_at"   TIMESTAMPTZ,
  "ip_hash"        TEXT         NOT NULL,   -- SHA-256 of request IP (GDPR evidence)
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX "device_consent_patient_token_idx" ON "device_consent" ("patient_token");
CREATE INDEX "device_consent_device_id_idx"     ON "device_consent" ("device_id");

-- ── device_alert_thresholds ───────────────────────────────────────────────────
-- Clinician-configurable per patient. set_by_physician_id is an opaque physician
-- id (TEXT, as elsewhere in this schema — there is no physicians table; physician
-- identity comes from the staff/eID directory).

CREATE TABLE "device_alert_thresholds" (
  "id"                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_token"            TEXT          NOT NULL,
  "metric_type"              TEXT          NOT NULL,
  "threshold_high"           NUMERIC(12,4),
  "threshold_low"            NUMERIC(12,4),
  "threshold_critical_high"  NUMERIC(12,4),
  "threshold_critical_low"   NUMERIC(12,4),
  "set_by_physician_id"      TEXT          NOT NULL,
  "created_at"               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"               TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX "device_alert_thresholds_patient_metric_idx"
  ON "device_alert_thresholds" ("patient_token", "metric_type");

-- ── device_sync_jobs ──────────────────────────────────────────────────────────

CREATE TABLE "device_sync_jobs" (
  "id"               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  "device_id"        UUID          NOT NULL REFERENCES "wearable_devices"("id"),
  "status"           TEXT          NOT NULL,   -- 'pending'|'running'|'completed'|'failed'
  "started_at"       TIMESTAMPTZ,
  "completed_at"     TIMESTAMPTZ,
  "readings_fetched" INTEGER       NOT NULL DEFAULT 0,
  "error"            TEXT,
  "created_at"       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX "device_sync_jobs_device_id_idx" ON "device_sync_jobs" ("device_id");
CREATE INDEX "device_sync_jobs_status_idx"    ON "device_sync_jobs" ("status");
