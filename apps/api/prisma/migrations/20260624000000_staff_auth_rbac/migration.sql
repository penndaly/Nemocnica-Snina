-- Sprint A2 — Staff Authentication, MFA, RBAC & Super Admin user management.
--
-- Adds the staff_accounts model (invite lifecycle, AES-256-GCM TOTP secret,
-- bcrypt recovery codes), item-level access scopes, short-lived auth tokens,
-- and a revocable session index.
--
-- NOTE: audit_log already exists (created in the baseline + made append-only by
-- infra/postgres/audit-immutability.sql — REVOKE UPDATE/DELETE + trigger). A2
-- reuses it via the existing AuditService rather than redefining it, so no
-- audit_log DDL here.

-- ── staff_accounts ───────────────────────────────────────────────────────────
CREATE TABLE "staff_accounts" (
  "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
  "email"          VARCHAR(255) NOT NULL,
  "name"           VARCHAR(255) NOT NULL,
  "role"           VARCHAR(32)  NOT NULL,
  "password_hash"  VARCHAR(255),                 -- bcrypt; NULL until invite accepted
  "totp_secret"    TEXT,                          -- AES-256-GCM ciphertext; NULL until MFA setup
  "totp_enabled"   BOOLEAN      NOT NULL DEFAULT FALSE,
  "recovery_codes" TEXT[]       NOT NULL DEFAULT '{}', -- bcrypt-hashed; 10 codes
  "status"         VARCHAR(16)  NOT NULL DEFAULT 'invited',
  "last_login_at"  TIMESTAMPTZ,
  "last_login_ip"  INET,
  "created_by"     UUID,
  "created_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_accounts_role_check"
    CHECK ("role" IN ('super_admin','administrator','clinician','editor')),
  CONSTRAINT "staff_accounts_status_check"
    CHECK ("status" IN ('invited','active','disabled')),
  CONSTRAINT "staff_accounts_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "staff_accounts"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "staff_accounts_email_key" ON "staff_accounts" ("email");
CREATE INDEX "staff_accounts_status_idx" ON "staff_accounts" ("status");

-- ── staff_access_scopes ──────────────────────────────────────────────────────
-- No scope rows of a type ⇒ unrestricted for that type. Rows present ⇒ access
-- limited to those scope_target_ids only.
CREATE TABLE "staff_access_scopes" (
  "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_id"        UUID        NOT NULL,
  "scope_type"      VARCHAR(32) NOT NULL,
  "scope_target_id" VARCHAR(64) NOT NULL,
  "created_by"      UUID,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_access_scopes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_access_scopes_scope_type_check"
    CHECK ("scope_type" IN ('department','clinic','physician','facility')),
  CONSTRAINT "staff_access_scopes_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE,
  CONSTRAINT "staff_access_scopes_staff_id_scope_type_scope_target_id_key"
    UNIQUE ("staff_id","scope_type","scope_target_id")
);
CREATE INDEX "staff_access_scopes_staff_id_idx" ON "staff_access_scopes" ("staff_id");

-- ── staff_auth_tokens ────────────────────────────────────────────────────────
CREATE TABLE "staff_auth_tokens" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "staff_id"   UUID        NOT NULL,
  "type"       VARCHAR(16) NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,           -- SHA-256 of the raw token
  "expires_at" TIMESTAMPTZ NOT NULL,
  "used_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "staff_auth_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "staff_auth_tokens_type_check"
    CHECK ("type" IN ('invite','reset','mfa_reset')),
  CONSTRAINT "staff_auth_tokens_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE
);
CREATE INDEX "staff_auth_tokens_token_hash_idx" ON "staff_auth_tokens" ("token_hash");
CREATE INDEX "staff_auth_tokens_staff_id_idx" ON "staff_auth_tokens" ("staff_id");

-- ── staff_sessions (JWT revocation index) ────────────────────────────────────
CREATE TABLE "staff_sessions" (
  "jti"        UUID        NOT NULL,
  "staff_id"   UUID        NOT NULL,
  "issued_at"  TIMESTAMPTZ NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "user_agent" TEXT,
  "ip_address" INET,
  CONSTRAINT "staff_sessions_pkey" PRIMARY KEY ("jti"),
  CONSTRAINT "staff_sessions_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "staff_accounts"("id") ON DELETE CASCADE
);
CREATE INDEX "staff_sessions_staff_id_idx" ON "staff_sessions" ("staff_id");
