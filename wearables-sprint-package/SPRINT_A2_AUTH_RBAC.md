# Sprint A2 — Staff Authentication, MFA, RBAC & Super Admin User Management
## Nemocnica Snina · Admin Backend Production Wiring

**Branch:** `feature/admin-a2-auth-rbac`
**Depends on:** A1 ✅ merged (Strapi content types + NestJS CMS API live)
**Design prototypes:** `admin.html` (login screen, role descriptions) · `Admin User Guide.html` §Roles
**Architecture ref:** `PRODUCTION_ARCHITECTURE.md` — `MFA_REQUIRED=true` non-negotiable in production

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. admin.html (login screen, role descriptions, shell layout)
2. Admin User Guide.html §02 (sign-in & security) · §17 (roles & permissions)
3. assets/admin.js ADMIN.isAuthed / ADMIN.login — prototype auth to replace
4. PRODUCTION_ARCHITECTURE.md §Auth (staff JWT, MFA, OIDC)
5. apps/api/src/auth/auth.service.ts (existing patient auth — staff auth extends this module)
6. apps/api/src/config/config.schema.ts (config validator — add new env vars here)
7. DATA_MODEL.md (schema conventions — staff_accounts table extends this)

Execute Sprint A2 only. Stop and report Done-when criteria before starting A3.
```

---

## Non-negotiables

- `MFA_REQUIRED=true` in production. No staff login without TOTP. No bypass.
- Staff JWT is separate from patient JWT — different signing key (`STAFF_JWT_SECRET`), different `aud` claim (`ns.staff`), never accepted on patient endpoints.
- Super admin role (`super_admin`) is the only role that can create, edit, disable, or delete other staff accounts. Administrators can view users but not modify them.
- Access scopes are enforced server-side on every CMS API request. Client UI is cosmetic only.
- Invite and reset emails are rate-limited: max 3 per email address per hour.
- Invites expire after 72 hours. Reset tokens expire after 30 minutes.
- All staff account events (create, login, mfa_setup, mfa_reset, password_reset, role_change, scope_change, disable, delete, invite_sent) write an `audit_log` row (A3 implements the full audit engine; A2 writes directly to the table using the schema defined below).
- `OIDC_MOCK_ENABLED=false` in production (config validator enforces).
- Deactivated accounts: sessions revoked immediately via Redis key deletion; JWT blacklist via Redis `jti` set.

---

## Part A — Database schema (`apps/api/prisma/migrations/`)

```sql
-- Staff accounts
CREATE TABLE staff_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  role          VARCHAR(32)  NOT NULL CHECK (role IN ('super_admin','administrator','clinician','editor')),
  password_hash VARCHAR(255),               -- bcrypt; NULL until invite accepted
  totp_secret   TEXT,                       -- AES-256-GCM encrypted; NULL until MFA setup
  totp_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  recovery_codes TEXT[],                    -- bcrypt-hashed; 10 codes; NULL until MFA setup
  status        VARCHAR(16)  NOT NULL DEFAULT 'invited'
                CHECK (status IN ('invited','active','disabled')),
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  created_by    UUID REFERENCES staff_accounts(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access scopes — restrict an account to specific content items
-- If no scope rows exist for an account, they have access to ALL items of that type.
-- If scope rows exist, they can only read/write items whose id is in the list.
CREATE TABLE staff_access_scopes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  scope_type      VARCHAR(32) NOT NULL
                  CHECK (scope_type IN ('department','clinic','physician','facility')),
  scope_target_id VARCHAR(64) NOT NULL,  -- Strapi slug / id of the restricted item
  created_by      UUID REFERENCES staff_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, scope_type, scope_target_id)
);

-- Invite + reset tokens (short-lived; deleted on use or expiry)
CREATE TABLE staff_auth_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  type        VARCHAR(16) NOT NULL CHECK (type IN ('invite','reset','mfa_reset')),
  token_hash  VARCHAR(255) NOT NULL,   -- SHA-256 of raw token
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JWT session index (for revocation)
CREATE TABLE staff_sessions (
  jti         UUID PRIMARY KEY,
  staff_id    UUID NOT NULL REFERENCES staff_accounts(id) ON DELETE CASCADE,
  issued_at   TIMESTAMPTZ NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  user_agent  TEXT,
  ip_address  INET
);

-- Audit log (append-only — full schema in A3; A2 writes to this table directly)
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id   UUID,                  -- staff_accounts.id; NULL for system actions
  actor_name VARCHAR(255),          -- denormalised for readability after account deletion
  action     VARCHAR(64) NOT NULL,
  target_type VARCHAR(64),          -- 'staff_account' | 'department' | 'clinic' | etc.
  target_id   VARCHAR(255),
  meta        JSONB,
  ip_address  INET,
  user_agent  TEXT
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;  -- append-only enforced at DB layer
```

---

## Part B — Auth service (`apps/api/src/auth/staff-auth.service.ts`)

```typescript
// Extend existing AuthModule with StaffAuthService.
// Staff auth flow:

// 1. Login (step 1 — password)
login(email: string, password: string): Promise<{ mfaToken: string }>
  - SELECT staff WHERE email = email AND status = 'active'
  - bcrypt.compare(password, password_hash)
  - If ok: issue short-lived MFA challenge token (5 min, signed with STAFF_MFA_SECRET, aud='ns.staff.mfa')
  - If not ok: increment rate-limit counter (Redis 'staff:ratelimit:{email}'); lock after 10 failures/hour
  - audit_log: action='staff_login_attempt', meta={success,reason}

// 2. Login (step 2 — TOTP)
verifyMfa(mfaToken: string, totpCode: string): Promise<{ accessToken: string, refreshToken: string }>
  - Verify mfaToken (short-lived challenge token)
  - (otplib as any).authenticator.verify({ token: totpCode, secret: decryptedTotpSecret })
  - If ok: issue staff JWT (accessToken 15 min) + refreshToken (7 days, stored in HttpOnly cookie)
  - INSERT staff_sessions (jti, staff_id, issued_at, expires_at, ip)
  - UPDATE staff_accounts SET last_login_at, last_login_ip
  - audit_log: action='staff_login_success'
  - If code invalid: audit_log action='staff_mfa_failure'; rate-limit as above

// 3. MFA setup (first login after invite accepted)
setupMfa(staffId: string): Promise<{ otpauthUrl: string, secret: string }>
  - Generate TOTP secret via (otplib as any).authenticator.generateSecret()
  - Encrypt with AES-256-GCM (STAFF_TOTP_KEY env var)
  - Store encrypted in staff_accounts.totp_secret (totp_enabled = FALSE until confirmMfa)
  - Return otpauthUrl for QR code generation client-side

confirmMfa(staffId: string, totpCode: string): Promise<{ recoveryCodes: string[] }>
  - Verify totpCode against secret
  - SET totp_enabled = TRUE
  - Generate 10 recovery codes (crypto.randomBytes(10) each)
  - Store bcrypt-hashed codes in recovery_codes[]
  - Return plain codes once — never again
  - audit_log: action='mfa_setup_complete'

// 4. Token refresh
refresh(refreshToken: string): Promise<{ accessToken: string }>
  - Validate HttpOnly refresh cookie
  - Check staff_sessions not revoked
  - Issue new accessToken; update session
  - Return 401 if session revoked or expired

// 5. Logout
logout(jti: string): Promise<void>
  - UPDATE staff_sessions SET revoked_at = NOW() WHERE jti = jti
  - Add jti to Redis blacklist set (TTL = remaining token lifetime)
  - audit_log: action='staff_logout'
```

---

## Part C — Auth guard (`apps/api/src/auth/staff-jwt.guard.ts`)

```typescript
// StaffJwtGuard: validates staff access tokens on all /api/cms/ routes.
// Checks:
//   1. Bearer token present and signature valid (STAFF_JWT_SECRET, aud='ns.staff')
//   2. jti not in Redis blacklist (revoked sessions)
//   3. staff_accounts.status = 'active'
//   4. Attaches { staffId, role, scopes } to request for downstream use.

// ScopeGuard: applied per CMS route.
//   - If staff has no scope rows of type X: pass (unrestricted access).
//   - If staff has scope rows of type X: target item's slug must be in scope list.
//   - Throws ForbiddenException('SCOPE_DENIED') if out of scope.
//   - super_admin and administrator roles bypass scope checks.
```

---

## Part D — Super Admin user management module (`apps/api/src/admin-users/`)

```typescript
// AdminUsersModule — routes: /api/admin/users/
// ALL routes require role = 'super_admin'.
// Exception: GET /api/admin/users and GET /api/admin/users/:id also accessible to 'administrator' (read-only).

// ---- User CRUD ----

GET    /api/admin/users
  Returns: staff_accounts[] with scopes[] populated, last_login_at, status, mfa status.
  Supports: ?role=editor&status=active&search=jana (search on name + email).

GET    /api/admin/users/:id
  Returns: full profile including scopes[], recent audit_log entries (last 20).

POST   /api/admin/users
  Body: { name, email, role, scopes?: ScopeDto[] }
  Creates account with status='invited', password_hash=NULL, totp_enabled=FALSE.
  Immediately calls sendInviteEmail(email, inviteToken).
  audit_log: action='staff_account_created', actor=superAdminId, meta={email,role}

PUT    /api/admin/users/:id
  Body: { name?, role?, status?, scopes? }
  Restrictions:
    - Cannot change own role or status.
    - Cannot demote another super_admin (must be last super_admin check).
    - status='disabled' → revoke all active sessions immediately.
  audit_log: action='staff_account_updated', meta={changes}

DELETE /api/admin/users/:id
  Soft-delete: SET status='disabled', anonymise email to 'deleted-{id}@ns.internal'.
  Revoke all sessions.
  Retain audit_log rows (actor_name is already denormalised).
  Cannot delete own account.
  Cannot delete the last active super_admin.
  audit_log: action='staff_account_deleted'

// ---- Invite & reset ----

POST   /api/admin/users/:id/invite
  Re-sends or re-issues invite email (e.g. if original expired).
  Rate-limit: max 3 per email per hour.
  Generates new invite token (crypto.randomBytes(32) → hex), SHA-256 hash stored.
  Token expires 72 hours.
  audit_log: action='invite_sent'

POST   /api/admin/users/:id/reset-password
  Issues a password reset token (30 min expiry).
  Sends reset email to account's email address.
  Rate-limit: max 3 per email per hour.
  Does NOT invalidate existing sessions (admin may be logged in on another device).
  audit_log: action='password_reset_issued'

POST   /api/admin/users/:id/reset-mfa
  Clears totp_secret, totp_enabled=FALSE, recovery_codes=[].
  Issues mfa_reset token (30 min) — user must set up TOTP fresh on next login.
  Revokes all active sessions for that account (forces re-login + MFA setup).
  audit_log: action='mfa_reset_issued', actor=superAdminId

POST   /api/admin/users/:id/revoke-sessions
  Marks all staff_sessions for :id as revoked.
  Adds all active jtis to Redis blacklist.
  Sends email notification to account: "Your sessions were revoked by an administrator."
  audit_log: action='sessions_revoked', actor=superAdminId

// ---- Scope management ----

PUT    /api/admin/users/:id/scopes
  Body: { scopes: ScopeDto[] }
  // ScopeDto: { scope_type: 'department'|'clinic'|'physician'|'facility', scope_target_id: string }
  Replaces all scope rows for this staff member atomically (DELETE + INSERT in a transaction).
  Empty array = unrestricted (all scope rows removed).
  audit_log: action='scopes_updated', meta={previous, updated}
  Scope changes take effect on next token refresh (not immediately, max 15 min delay — accessToken lifetime).
  For immediate enforcement: call revoke-sessions first.
```

---

## Part E — Email service (`apps/api/src/notifications/staff-email.service.ts`)

```typescript
// Uses existing email transport (SMTP env vars from PRODUCTION_ARCHITECTURE.md).
// All emails are bilingual SK primary, EN secondary.

sendInviteEmail(to: string, name: string, inviteToken: string, role: string): Promise<void>
  Subject: "Nemocnica Snina — Pozvánka do administrácie / Admin invitation"
  Body:
    - Greeting + role description (SK/EN)
    - Accept invite link: ${ADMIN_URL}/accept-invite?token=${inviteToken}
    - "This link expires in 72 hours."
    - IT support contact
  inviteToken is the raw token (not the hash) — only appears in this email, never logged.

sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<void>
  Subject: "Nemocnica Snina — Obnovenie hesla / Password reset"
  Body:
    - Reset link: ${ADMIN_URL}/reset-password?token=${resetToken}
    - "This link expires in 30 minutes."
    - "If you did not request this, contact IT immediately."

sendMfaResetEmail(to: string, name: string, resetToken: string): Promise<void>
  Subject: "Nemocnica Snina — Obnovenie MFA / MFA reset"
  Body:
    - "Your two-factor authentication was reset by an administrator."
    - Setup link: ${ADMIN_URL}/setup-mfa?token=${resetToken}
    - "Expires in 30 minutes."

sendSessionRevokedEmail(to: string, name: string): Promise<void>
  Subject: "Nemocnica Snina — Relácie zrušené / Sessions revoked"
  Body:
    - "All your active admin sessions were revoked."
    - "If this was not expected, contact IT immediately."
    - IT emergency contact number.

// Rate limiting (all send* methods):
//   Redis key: 'staff:email_rate:{normalised_email}'
//   Max 3 emails per hour per address. Throws TooManyRequestsException on breach.
```

---

## Part F — Accept invite & password setup flow

```typescript
// Public routes (no auth required):

POST /api/auth/staff/accept-invite
  Body: { token: string, password: string }
  - Find staff_auth_tokens WHERE type='invite' AND token_hash=SHA256(token) AND used_at IS NULL
  - Check expires_at > NOW()
  - bcrypt.hash(password) → UPDATE staff_accounts SET password_hash, status='active'
  - Mark token used_at = NOW()
  - Return: { mfaSetupRequired: true } — client redirects to MFA setup
  - audit_log: action='invite_accepted'

POST /api/auth/staff/setup-mfa
  Body: { setupToken: string, totpCode: string }
  // setupToken is the mfa_reset token issued after invite acceptance
  - Verify token
  - Call confirmMfa() → returns recovery codes
  - Return: { recoveryCodes: string[] }  ← shown once; user must copy

POST /api/auth/staff/reset-password
  Body: { token: string, password: string }
  - Validate reset token (30 min)
  - bcrypt.hash(password) → update password_hash
  - Mark token used
  - audit_log: action='password_reset_complete'
```

---

## Part G — Super Admin UI module in `admin.html`

Add a new **Users** section to the admin nav rail (visible only to `super_admin` role; hidden for all others via JWT role claim).

```
Nav rail addition (super_admin only):
  ──────────────────── (divider)
  SUPER ADMIN
  [users icon]  Používatelia  (Users)

Users list view:
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  Name            Email              Role          Status    Last login  │
  ├─────────────────────────────────────────────────────────────────────────┤
  │  [avatar] Jana B.  jana@...  [clinician] [● Active]  12 min ago  [⋯]  │
  │  [avatar] Tomáš K. tomas@... [editor]    [● Active]  2 days ago  [⋯]  │
  │  [avatar] Mária S. maria@... [editor]    [○ Invited] —           [⋯]  │
  │  [avatar] Ján N.   jan@...   [admin]     [✕ Disabled] 30 days    [⋯]  │
  └─────────────────────────────────────────────────────────────────────────┘
  [+ Add user] button (top right)

Status badges:
  ● Active    → badge-green
  ○ Invited   → badge-blue  (pending invite acceptance)
  ✕ Disabled  → badge-gray

Role badges:
  super_admin  → badge-terra  "Super admin"
  administrator → badge-blue  "Administrator"
  clinician    → badge-green  "Clinician"
  editor       → badge-gray   "Editor"

Row action menu [⋯]:
  Edit user
  Manage access scopes
  Re-send invite / Reset password
  Reset MFA
  Revoke all sessions
  ── (divider)
  Disable account  (red / danger)

User editor (drawer or full page):
  Name (text)
  Email (email — editable only if status='invited' or for super_admin)
  Role (dropdown: super_admin / administrator / clinician / editor)
  Status (dropdown: active / disabled — not editable for own account)

  ── Access scopes ──────────────────────────────────────────────────
  "Leave all checkboxes blank for unrestricted access.
   Check items to restrict this user to those items only."

  Departments  (multi-select checkboxes, names from DB)
    ☑ Chirurgia a traumatológia
    ☑ Interné oddelenie
    ☐ Gynekológia a pôrodníctvo
    … (all departments)

  Clinics      (multi-select checkboxes)
    ☐ Urologická ambulancia
    ☐ Angiologická ambulancia
    … (all clinics)

  Physicians   (multi-select checkboxes)
    … (all physicians)

  Diagnostics  (multi-select checkboxes)
    … (all facilities)

  [Save user]  [Cancel]

MFA status indicator per user:
  ● MFA active  → green chip
  ○ MFA pending → amber chip (invited, not yet set up)
  ✕ MFA reset   → red chip  (admin reset, waiting for user to re-setup)

Note: Super admin UI calls /api/admin/users/* endpoints.
      All operations are confirmed with a native confirm() dialog before executing.
      Destructive actions (disable, delete, revoke sessions) show a warning.
```

---

## Part H — Environment variables added by A2

```env
# Staff auth
STAFF_JWT_SECRET=          # 64-char hex — generate: openssl rand -hex 32
STAFF_MFA_SECRET=          # 64-char hex — for MFA challenge tokens
STAFF_TOTP_KEY=            # 32-char hex — AES-256-GCM key for TOTP secret encryption
STAFF_JWT_EXPIRES_IN=15m
STAFF_REFRESH_EXPIRES_IN=7d
STAFF_INVITE_EXPIRES_H=72
STAFF_RESET_EXPIRES_M=30
ADMIN_URL=http://localhost:3000/admin     # used in invite/reset email links

# Rate limiting
STAFF_EMAIL_RATE_LIMIT=3                 # per hour per address

# OIDC (future — stubbed for now)
OIDC_MOCK_ENABLED=false                  # config validator rejects true in production
```

---

## Part I — Tests

```typescript
// Unit tests (staff-auth.service.spec.ts):
// - login: correct password → mfaToken issued
// - login: wrong password → 401; rate-limit counter incremented
// - verifyMfa: correct TOTP → accessToken + refreshToken; session inserted
// - verifyMfa: wrong TOTP → 401; rate-limit counter incremented
// - logout: jti added to Redis blacklist; subsequent request with same jti → 401
// - revoke-sessions: all jtis for user added to Redis blacklist

// Unit tests (admin-users.service.spec.ts):
// - POST /users: super_admin creates editor → status='invited', invite email sent
// - POST /users/:id/invite: rate-limit 3/hour → 4th call → 429
// - DELETE /users/:id: last super_admin → 409 Conflict
// - DELETE /users/:id: own account → 403 Forbidden
// - PUT /users/:id/scopes: replaces scopes atomically

// E2E (Playwright):
// A2-1  Staff login: correct password + TOTP → 200 + JWT in cookie; admin shell loads.
// A2-2  Staff login: wrong password 10 times → 429 Too Many Requests.
// A2-3  Staff login with revoked session → 401 on next request.
// A2-4  Editor with dept scope [chirurgia] → GET /api/cms/departments/interne → 403 SCOPE_DENIED.
// A2-5  Editor with no dept scope → GET /api/cms/departments/interne → 200 (unrestricted).
// A2-6  Administrator attempts POST /api/admin/users → 403 (super_admin only).
// A2-7  Super admin creates editor → invite email received (MailHog) → accept invite → MFA setup → login.
// A2-8  Super admin resets MFA → account totp_enabled=false → user forced through MFA setup on next login.
// A2-9  MFA_REQUIRED=true: attempt login without TOTP step → blocked.
```

---

## Done when

- [ ] Staff login: password → MFA challenge token → TOTP → JWT (A2-1 green)
- [ ] Rate limiting on login failures and email sends (A2-2 green)
- [ ] JWT revocation via Redis blacklist (A2-3 green)
- [ ] `StaffJwtGuard` on all `/api/cms/` routes; `ScopeGuard` enforces item-level access (A2-4, A2-5 green)
- [ ] `super_admin` role gating on `/api/admin/users/` (A2-6 green)
- [ ] Invite flow: create → email → accept → MFA setup → active (A2-7 green)
- [ ] MFA reset flow: admin reset → forced re-setup on next login (A2-8 green)
- [ ] `MFA_REQUIRED=true` enforced; config validator rejects `OIDC_MOCK_ENABLED=true` in production
- [ ] Super Admin Users UI in `admin.html`: list, create, edit, scopes, invite, reset, disable
- [ ] All staff account events writing to `audit_log` table
- [ ] A2-1 through A2-9 green
