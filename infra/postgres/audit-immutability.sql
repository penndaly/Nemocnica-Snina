-- =========================================================
-- Audit log immutability — Decree 179/2020
--
-- This script must be run ONCE by a superuser after the
-- Prisma migration creates the audit_log table.
-- It is idempotent (IF NOT EXISTS / OR REPLACE).
--
-- Three independent layers of protection:
--   1. Separate application role (ns_app) with no UPDATE/DELETE grant
--   2. Row-level trigger that raises an exception on any attempted mutation
--   3. Revocation of UPDATE/DELETE from PUBLIC (belt-and-suspenders)
--
-- Layer 1 + 3 stop SQL at the privilege level.
-- Layer 2 stops it even if someone connects as a superuser by mistake
-- (trigger fires for all roles unless SECURITY DEFINER is bypassed,
--  which requires explicit superuser override — auditable).
-- =========================================================

-- ── Create the application role (idempotent) ─────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ns_app') THEN
    CREATE ROLE ns_app LOGIN PASSWORD :'NS_APP_PASSWORD';
  END IF;
END$$;

-- ── Grant only what the application actually needs ───────
-- nemocnica_snina operational DB
GRANT CONNECT ON DATABASE nemocnica_snina TO ns_app;
GRANT USAGE ON SCHEMA public TO ns_app;

-- Full CRUD on all tables except audit_log
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ns_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ns_app;

-- audit_log: INSERT + SELECT only — NO UPDATE, NO DELETE
REVOKE UPDATE, DELETE ON audit_log FROM ns_app;
-- Also revoke from PUBLIC so no role inherits these via PUBLIC
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- Sequences (for auto-increment, though we use UUID PKs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ns_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ns_app;


-- ── Trigger function: raise on any mutation attempt ───────
-- This fires for ALL roles, including superuser, unless the session
-- explicitly sets session_replication_role = 'replica'. Any such
-- override is itself a database event visible to the system audit trail.
CREATE OR REPLACE FUNCTION audit_log_no_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log is append-only. UPDATE and DELETE are prohibited. '
    'Attempted operation: % by session user: %',
    TG_OP, session_user
    USING ERRCODE = 'insufficient_privilege';
  RETURN NULL;
END;
$$;

-- ── Attach trigger to audit_log ───────────────────────────
DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;

CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_no_mutation();


-- ── Verification query (run manually to confirm) ──────────
-- SELECT grantee, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE table_name = 'audit_log'
-- ORDER BY grantee, privilege_type;
--
-- Expected: ns_app has INSERT + SELECT only.
-- Expected: no UPDATE or DELETE in the output.
