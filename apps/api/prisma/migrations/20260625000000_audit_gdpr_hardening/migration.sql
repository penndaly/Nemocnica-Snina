-- Sprint A3 — Audit log hardening + GDPR meta-anonymisation.
--
-- The append-only protection (role REVOKE + immutability trigger) was first
-- applied out-of-band via infra/postgres/audit-immutability.sql in A2. This
-- migration brings the trigger + query indexes into Prisma migration history
-- (idempotent — safe over the infra-created objects) and adds the single,
-- tightly-scoped GDPR exception: a SECURITY DEFINER function that anonymises
-- PII in the `detail` JSON column ONLY (never deletes rows).
--
-- Column names match the Prisma AuditLog model (unmapped → quoted camelCase):
--   "actorId", "action", "resource", "resourceId", "detail", "createdAt".

-- ── Immutability trigger (second layer; layer 1 = role REVOKE) ───────────────
CREATE OR REPLACE FUNCTION audit_log_no_mutate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. UPDATE/DELETE is not permitted (op: %).', TG_OP
    USING ERRCODE = 'insufficient_privilege';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;
CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutate();

-- ── Query indexes for the audit API (idempotent) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_ts
  ON audit_log ("actorId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_ts
  ON audit_log ("action", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_ts
  ON audit_log ("resource", "resourceId", "createdAt" DESC);

-- ── GDPR Art. 17 meta-anonymisation (single trigger exception) ───────────────
-- Anonymises PII inside the `detail` JSON for every audit row referencing a
-- patient_token, WITHOUT deleting rows. Runs as the function owner and disables
-- row triggers for the statement only (session_replication_role = replica),
-- so the immutability trigger is bypassed for this one auditable operation and
-- nothing else. Returns the number of rows anonymised.
CREATE OR REPLACE FUNCTION audit_log_anonymise_patient(p_token text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  SET LOCAL session_replication_role = 'replica';  -- bypass row triggers for this txn only
  UPDATE audit_log
     SET "detail" = jsonb_set(
            COALESCE("detail", '{}'::jsonb) - 'patient_token' - 'patientToken' - 'email' - 'patientRc',
            '{patient_token}', '"[erased]"'::jsonb, true)
   WHERE "detail" @> jsonb_build_object('patient_token', p_token)
      OR "detail" @> jsonb_build_object('patientToken', p_token);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- Lock the function down: only the DB owner / migrator may execute it; the app
-- role calls it through a controlled service path in production deployments.
REVOKE ALL ON FUNCTION audit_log_anonymise_patient(text) FROM PUBLIC;
