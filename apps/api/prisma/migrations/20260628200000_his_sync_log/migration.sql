-- QA: idempotency ledger for HIS FHIR sync. A resource-creating event claims a
-- (idempotency_key, event_type) row before posting to FHIR; a RabbitMQ redelivery
-- then skips, preventing duplicate Appointment/EpisodeOfCare/MedicationRequest/Task.
CREATE TABLE IF NOT EXISTS "his_sync_log" (
  "id"              TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "event_type"      TEXT NOT NULL,
  "synced_at"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "his_sync_log_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "his_sync_log_idempotency_key_event_type_key"
  ON "his_sync_log" ("idempotency_key", "event_type");
