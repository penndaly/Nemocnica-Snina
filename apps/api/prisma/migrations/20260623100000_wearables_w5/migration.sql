-- Wearables & Remote Monitoring — Sprint W5 (Alerts, Physician View, FHIR Export)
-- Adds the portal_notifications table (wearable alerts, token-expiry, consent
-- re-confirmation) and a uniqueness constraint enabling per-(patient, metric)
-- threshold upserts. No patient identity stored — opaque patient_token only.

-- Per-(patient, metric) alert thresholds must be unique for upsert.
ALTER TABLE "device_alert_thresholds"
  ADD CONSTRAINT "device_alert_thresholds_patient_token_metric_type_key"
  UNIQUE ("patient_token", "metric_type");

-- Portal notifications (in-app alert inbox).
CREATE TABLE "portal_notifications" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "patient_token" TEXT         NOT NULL,
  "type"          TEXT         NOT NULL,
  "severity"      TEXT         NOT NULL DEFAULT 'info',
  "device_id"     UUID,
  "physician_id"  TEXT,
  "metric_type"   TEXT,
  "value"         TEXT,
  "flag"          TEXT,
  "message"       TEXT,
  "read_at"       TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT "portal_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_pn_patient_read"   ON "portal_notifications" ("patient_token", "read_at");
CREATE INDEX "idx_pn_physician_time" ON "portal_notifications" ("physician_id", "created_at");
CREATE INDEX "idx_pn_type"           ON "portal_notifications" ("type");
