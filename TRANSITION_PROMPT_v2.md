# Nemocnica Snina (Snina Hospital) — Claude Code Transition Prompt
## Paste this as your first message in a new Claude Code session
### Date: June 24 2026

---

## What this project is

Production build of **Nemocnica Snina** (Snina Hospital) — a bilingual→multilingual public hospital website + patient portal + admin CMS + telemedicine module + wearables remote monitoring. Stack: Next.js 15 (App Router) + NestJS 10 + Strapi 4 + PostgreSQL (Prisma) + Redis + RabbitMQ + LiveKit EU. Package manager: always `pnpm`.

Read `CLAUDE.md` at the repo root before writing any code. It is the non-negotiable source of truth for architecture constraints, security rules, and stack decisions.

---

## Current state of main (`5481d4f`)

| Track | Status | Notes |
|---|---|---|
| Core platform S1–S5 | ✅ on main | Public site, portal, booking, payments, APS |
| Telemedicine S6–S11 | ✅ on main | LiveKit EU, FHIR HIS export, compliance gate |
| Wearables W1 + W4–W6 | ✅ on main | 4,124 lines, 43 files, 73 unit tests |
| Wearables W2 medical adapters | 🔄 feature branch — awaiting completion report |
| Wearables W3 consumer adapters | 🔄 feature branch — awaiting completion report |
| Admin CMS A1 | ✅ feature/admin-a1-api-wiring — ready to merge |
| Admin auth A2 | ✅ feature/admin-a2-auth-rbac — ready to merge |
| Admin audit/GDPR A3 | ✅ feature/admin-a3-audit-gdpr-i18n — ready to merge |

**Merge order before starting new work:**
```bash
git checkout main
git merge --ff-only feature/admin-a1-api-wiring && git push
git merge --ff-only feature/admin-a2-auth-rbac && git push
git merge --ff-only feature/admin-a3-audit-gdpr-i18n && git push
# Then merge W2/W3 when their sessions report done-when
```

---

## Completed sprint summary (do not re-do this work)

### Admin A1 — CMS write layer + public API + physician profiles
**Commits:** `a7b9714` (A1) + security fix (strictBool on 7 config flags — `z.coerce.boolean()` → `strictBool()`)
- Strapi i18n kept (not JSON {sk,en}) — correct for 6-locale roadmap (SK/EN/CS/PL/HU/UK)
- `slugify.ts` — verbatim port of `ADMIN.slugify()` (NFD→diacritics→hyphen→28 chars)
- `cms.schema.ts` field-spec bridge (prototype vocab → Strapi attribute names)
- `BilingualDto` + server-side bilingual validation (missing `.en` → 400, not coerced)
- `CmsAuthGuard` — `CMS_AUTH_BYPASS=true` dev-only; config validator rejects in production
- `strapi-cms.service.ts` — CRUD + singletons + media proxy (images ≤10 MB, PDFs ≤50 MB)
- 13 `/api/public/*` endpoints — `?locale=` threaded to Strapi, never hardcoded
- `cms-api.ts` client — `fetchPublic(${NEXT_PUBLIC_API_URL}/api/public, throws 4xx/5xx)`
- Physician profile pages `/[lang]/lekari/[slug]` — SSR, generateStaticParams, 404, photo/initials, accepting badge, lang chips, breadcrumb
- Directory cards now link to individual profiles
- 31/31 unit tests ✅

**Security fix (commit on same branch):** `strictBool(default)` applied to all 7 boolean flags: `MFA_REQUIRED`, `OIDC_USE_PKCE`, `OIDC_MOCK_ENABLED`, `HIS_MOCK_ENABLED`, `TELEHEALTH_RECORDING_ENABLED`, `TELEHEALTH_RECORDING_DPO_APPROVED`, `WEARABLES_ENABLED`. String `"false"` can no longer coerce to `true`. 8 unit tests cover prod gates.

---

### Admin A2 — Staff TOTP MFA, RBAC, Super Admin user management
**Branch:** `feature/admin-a2-auth-rbac`
**Migration:** `20260624000000_staff_auth_rbac` (staff_accounts, staff_access_scopes, staff_auth_tokens, staff_sessions)
- `StaffAuthService` — 2-step login (password → MFA challenge → TOTP → staff JWT)
- `StaffTotpCryptoService` — AES-256-GCM for TOTP secrets
- `StaffSecurityRedis` — JWT revocation blacklist + login-lock + email rate-limit (in-memory fallback for dev/CI)
- `StaffJwtGuard` (Bearer + `aud:ns.staff` + blacklist + status=active)
- `ScopeGuard` — item-level; super_admin/administrator bypass; no scope rows = unrestricted; else 403 SCOPE_DENIED
- `StaffRolesGuard` + `@StaffRoles`
- `/api/auth/staff/*` — login, verify-mfa, refresh (HttpOnly cookie), logout, accept-invite, setup-mfa, reset-password
- `/api/admin/users` — full CRUD + invite/reset-password/reset-mfa/revoke-sessions/scopes; super_admin-only mutations
- `StaffEmailService` — bilingual invite/reset/mfa-reset/session-revoked; rate-limited 3/hour
- Super Admin Users UI (`apps/web/src/app/admin/users/page.tsx`) — list, create/edit drawer, scope checkboxes, row actions
- All `/api/cms/` switched from A1 bypass guard to real `StaffJwtGuard + ScopeGuard`
- 28 unit tests ✅ · 229 total passing

**Key decisions locked:**
- `MFA_REQUIRED=true` enforced in production. Config validator rejects `false`.
- Staff JWT (`aud:ns.staff`) never accepted on patient endpoints
- `STAFF_TOTP_KEY` = 64 hex chars (32 bytes) — AES-256-GCM, not AES-128
- `audit_log` reused from existing table (not recreated) — staff events map to `resource='staff_account'`
- `CMS_AUTH_BYPASS` retained as dev/CI escape inside `StaffJwtGuard`; config validator rejects in production

---

### Admin A3 — Audit hardening, GDPR tools, translation gate, RC encryption fix
**Branch:** `feature/admin-a3-audit-gdpr-i18n`
**Commits (in order):**
1. `1af4857` — A3 backend
2. `594a1f3` — RC encryption security fix
3. `d905449` — Admin UI panels

**Migration:** `20260625000000_audit_gdpr_hardening` — immutability trigger (BEFORE UPDATE/DELETE raises exception), query indexes, `audit_log_anonymise_patient()` SECURITY DEFINER function (meta-only, rows never deleted)

**A3 backend (`1af4857`):**
- `AuditService.writeAuditEntry()` — ALLOWED_ACTIONS validation + recursive PII stripping (RC/email → SHA-256, patient_token → 8-char prefix, passwords/tokens → [redacted])
- Legacy `log()` still PII-strips but does not enforce ALLOWED_ACTIONS (avoids runtime throw on existing `dsar_export`/`payment.*`/`telehealth.his_sync.*` dynamic actions)
- `/api/audit` read API (query/by-staff/by-content) — role administrator|super_admin
- Translation gate: `translation-gate.ts` + Strapi `beforeUpdate` publish-block hook across 6 clinical collections; throws unless `review_status='approved'` for cs/pl/hu/uk; no bypass
- `review_status`/`reviewed_by`/`reviewed_at`/`review_notes` added to 6 clinical schemas (localized)
- `/api/cms/translations` — pending queue, review approve/reject→publish, item locales
- `TranslationProviderService` — mock (returns `"[MT] "+source`) | DeepL (env-switched via `MT_PROVIDER`)
- **GDPR (web-tier only — clinical data is HIS-side):**
  - `PatientGdprService` keyed by `patient_token` — export: device_readings, device_consents, portal_notifications, telehealth metadata, audit entries; erasure: super_admin + MFA re-verify; FHIR-linked readings preserved (Act 362/2011)
  - `StorageService` — AES-256-GCM at rest, HMAC signed single-use 5-min URLs, local|S3 env-switched
  - Export JSON includes `_note`: *"Clinical records are held in the hospital HIS as FHIR R4 resources. Contact the hospital data controller for clinical record access."*
- CMS tools API — `/api/cms/tools/export|import|reset` (export: administrator+; import/reset: super_admin; reset requires exact confirm string + password re-entry)
- `AdminAuthContext` migrated to two-step staff JWT flow — production Users UI authenticates without `CMS_AUTH_BYPASS`
- 25 unit tests ✅ · 263 total passing

**RC encryption fix (`594a1f3`):**
- `OnboardingApplication.patientRcEncrypted` column added (nullable AES-256-GCM)
- `RcCryptoService` — AES-256-GCM, mirrors A2 crypto pattern
- `apply()` now stores both bcrypt hash (`patientRcHash`) and ciphertext (`patientRcEncrypted`)
- `RC_ENCRYPTION_KEY` added to config validator (64-hex, all-zero rejected in production)
- NCZI: decrypts `patientRcEncrypted` before `generateEDohoda()`; null record throws descriptive error + writes `onboarding_manual_required` audit entry (silent [REDACTED] eliminated)
- GDPR export: includes decrypted RC if `patientRcEncrypted` present; null records include human-readable note
- 9 tests: round-trip/tamper, apply stores both (distinct), null throws (not [REDACTED]), export RC-vs-note ✅
- Migration: `20260626000000_add_rc_encrypted`

**Admin UI panels (`d905449`):**
- `/admin/translations` — pending queue by collection + locale filter (CS/PL/HU/UK), side-by-side SK/MT diff, approve→publish, reject+notes, pending count badge in nav
- `/admin/gdpr` — new request form (export|erasure), signed download URL display, recent requests log from audit_log
- `/admin/tools` — CMS export (signed download), import (file upload), reset (confirm string + password re-entry)
- `/admin/audit` — read-only audit log viewer, a11y semantics

**Infra-gated items (written as specs, need running stack):**
- DB trigger live verification (needs Postgres)
- Strapi lifecycle hook live verification (needs Strapi)
- S3 adapter (stubbed — `GDPR_STORAGE_PROVIDER=s3` activates it)
- DeepL provider (stubbed — `MT_PROVIDER=deepl` activates it)
- axe WCAG AA sweep (`RUN_AXE=1` guard)
- Full E2E A3-1–A3-9 (`RUN_A3_E2E=1` guard)

---

## Wearables W2/W3 — what to do when sessions report done

### W2 — Medical adapters (feature/wearables-w2-medical-adapters)
Expected: Abbott LibreLink EU (OAuth2 PKCE, EU server enforced), Dexcom G7 (PKCE), Withings (OAuth1→2 migration handled), Omron Connect (OAuth2). Three cardiac stubs: Medtronic, Abbott Cardiac, BSC — all return `{ error: 'PARTNERSHIP_REQUIRED' }` (no OAuth).

**When W2 reports done — verify before merging:**
- [ ] All 4 live adapters implement `WearablePlatformAdapter` interface from W1
- [ ] `TokenCryptoService` used for OAuth token encryption (not raw storage)
- [ ] `OAuthStateService` used for CSRF state — HMAC-signed (not Redis yet; flagged as gap)
- [ ] EU server enforcement on Abbott Libre (`LIBRE_REGION=eu` validated)
- [ ] Cardiac stubs return `PARTNERSHIP_REQUIRED` and do not initiate OAuth
- [ ] `WEARABLES_PROVIDER=live` requires `WEARABLES_ENABLED=true` (config validator)
- [ ] Unit tests cover token encryption, EU region enforcement, partnership stub
- [ ] No `physicians` table referenced (physician relationship via `TelehealthSession`)
- [ ] Merge: `git merge --ff-only feature/wearables-w2-medical-adapters`

### W3 — Consumer adapters (feature/wearables-w3-consumer-adapters)
Expected: Fitbit (OAuth2), Garmin (OAuth1 — webhook push already handled in W6; don't duplicate), Google Health Connect (OAuth2 PKCE), Samsung Health (OAuth2). Stubs: Apple Health (`IOS_APP_REQUIRED`), Huawei (`HUAWEI_BLOCKED_EU_ADEQUACY`), Meta (`PARTNERSHIP_REQUIRED`). Xiaomi: CSV manual upload endpoint.

**When W3 reports done — verify before merging:**
- [ ] All 4 live adapters implement `WearablePlatformAdapter` interface
- [ ] Garmin webhook handler from W6 is extended, not duplicated
- [ ] Apple returns `{ error: 'IOS_APP_REQUIRED' }` — no OAuth flow
- [ ] Huawei returns `{ error: 'HUAWEI_BLOCKED_EU_ADEQUACY' }` — config validator enforces
- [ ] Xiaomi CSV upload: POST `/api/wearables/upload/xiaomi`, multipart, maps to `RawReading[]`
- [ ] No conflict in `wearables.module.ts` with W2 (expected merge point — `MedicalAdaptersModule, ConsumerAdaptersModule`)
- [ ] Merge: `git merge --ff-only feature/wearables-w3-consumer-adapters`

**Conflict resolution (W2+W3 merge):**
The only expected conflict is `wearables.module.ts`:
```typescript
// W2 adds:         MedicalAdaptersModule,
// W3 adds:         ConsumerAdaptersModule,
// Merged result:   MedicalAdaptersModule, ConsumerAdaptersModule,
```

---

## Sprint WL9 — Wearables §L9 Compliance Gate
### Run after W2 + W3 are merged to main

This sprint closes the gap items documented in `WEARABLES_COMPLETION_REPORT.md` that are required before `WEARABLES_ENABLED=true` in production.

```
Read the following files before starting:
1. WEARABLES_COMPLETION_REPORT.md (full gap list and §L9 current status)
2. LAUNCH_CHECKLIST.md §L9 (wearables-specific gate items)
3. DPIA_WEARABLES_ADDENDUM.md (DPA/SCC/adequacy decision status per vendor)
4. apps/api/src/wearables/ (all W1+W4–W6 wearables source)
5. RETENTION.md (wearables section — retention purge cron is a gap item)

Execute Sprint WL9 only. Stop and report Done-when before starting L1.
```

**Part A — Redis OAuth state (closes CSRF one-time-use gap)**
```typescript
// Replace in-memory HMAC OAuth state with Redis KV store.
// Key:   'wearables:oauth_state:{state_token}'
// Value: { patientToken, platform, createdAt } — JSON, AES-256-GCM encrypted
// TTL:   15 minutes
// Use:   DEL key on first use (one-time-use enforced across all API instances)
// If Redis unavailable at state creation: throw 503 (do not fall back to in-memory)
// OAuthStateService.generateState() → creates Redis key, returns HMAC-signed token
// OAuthStateService.consumeState(token) → validates HMAC + Redis DEL (atomic); throws if missing
// Unit tests: create→consume (success), consume twice (fails), expired (fails), tampered HMAC (fails)
```

**Part B — Batch-alert 15-minute digest window (closes per-message batch gap)**
```typescript
// In wearables alert consumer (batch alerts only — not critical alerts):
// Redis key: 'wearables:alert_digest:{physician_id}:{window}'
//   where window = Math.floor(Date.now() / (15 * 60 * 1000))
// SETNX with 15-min TTL → if already set, accumulate alert into list (RPUSH)
//   → schedule digest send at TTL expiry (BullMQ delayed job)
// If SETNX succeeds (first alert in window): schedule BullMQ job (delay: 15 min)
// BullMQ job: collect all alerts for that physician in that window → send one digest SMS/notification
// Unit tests: first alert in window → job scheduled; second alert → appended (no second job); job fires → single digest
// Note: physician routing still uses WEARABLES_ALERT_SMS_TO (single escalation number)
//   until Sprint A2 staff accounts are wired to per-physician routing
```

**Part C — Retention purge cron (closes retention gap)**
```typescript
// Add to apps/api/src/wearables/wearables-cron.service.ts:

@Cron('0 2 * * *')  // 02:00 daily
async purgeExpiredReadings(): Promise<void> {
  // Delete device_readings where:
  //   consent has been withdrawn (device_consents.granted = false for 'data_storage')
  //   AND fhir_observation_id IS NULL (not legally required)
  //   AND received_at < NOW() - INTERVAL '${WEARABLES_GDPR_RETENTION_DAYS} days'
  // Never delete readings where fhir_observation_id IS NOT NULL (Act 362/2011)
  // audit_log: action='wearable_readings_purged', meta={count, retentionDays}
}

@Cron('0 3 * * *')  // 03:00 daily
async suspendStaleConsent(): Promise<void> {
  // Update wearable_devices SET sync_status='suspended' WHERE:
  //   connected_at < NOW() - INTERVAL '13 months'
  //   AND last_consent_review IS NULL
  //   AND sync_status != 'suspended'
  // Sends portal notification to patient: "Your device sync has been paused.
  //   Please review your consent settings."
  // Does NOT revoke OAuth tokens — patient can re-activate by reviewing consent
  // audit_log: action='consent_grace_suspended', meta={deviceId, platform}
}
```

**Part D — Huawei block config validation (close adequacy decision gap)**
```typescript
// In config validator: if WEARABLES_ENABLED=true:
//   assert HUAWEI_HEALTH_ENABLED !== 'true'
//   (Huawei blocked until EU adequacy decision — see DPIA_WEARABLES_ADDENDUM.md)
// Error message: 'HUAWEI_HEALTH_ENABLED must be false or unset until the EU
//   adequacy decision for China is adopted. See DPIA_WEARABLES_ADDENDUM.md.'
```

**Part E — §L9 gate verification**
```typescript
// Run all WR-1–WR-9 E2E specs (apps/web/e2e/wearables*.spec.ts) against staging.
// These are infra-gated (TEST_PATIENT_JWT + running stack required).
// Report each spec: green / infra-gated / failing.

// WR-1: Consent required before any reading is stored
// WR-2: Withdrawn consent stops sync within one sync cycle
// WR-3: Device readings isolated by patient_token (cross-patient read = 403)
// WR-4: Physician access requires appointment or telehealth session
// WR-5: FHIR-linked readings survive GDPR erasure
// WR-6: OAuth state is one-time-use (WL9 Part A — Redis)
// WR-7: Garmin webhook rejected without valid HMAC-SHA1
// WR-8: WEARABLES_PROVIDER=live rejected without WEARABLES_ENABLED=true
// WR-9: axe zero critical/serious on /portal?tab=wearables and /portal/wearables/sublas
```

**Done when:**
- [ ] OAuth state: Redis KV, 15-min TTL, one-time-use, DEL on consume, unit tests (WR-6 green)
- [ ] Batch digest: Redis SETNX window, BullMQ delayed job, single digest per physician per 15 min
- [ ] Retention purge cron: runs daily, never deletes FHIR-linked readings, audit_log entry
- [ ] Consent-grace cron: suspends sync after 13 months without review, portal notification
- [ ] Huawei block validated by config validator
- [ ] WR-1–WR-5, WR-7, WR-8: unit-tested or infra-confirmed green
- [ ] WR-6: Redis OAuth state unit tests green; live confirm infra-gated
- [ ] WR-9: axe spec written; infra-gated for live run
- [ ] `WEARABLES_ENABLED=true` path is unblocked from a code perspective; remaining blockers are ops (vendor DPAs, SCCs, DPO signature) — documented in §L9 gate status

---

## Sprint L1-PREP — Ops credential provisioning checklist
### Run after WL9 is merged; hand to ops team

```
Read the following files before starting:
1. design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md §L1 (full text)
2. design_handoff_nemocnica_snina/CONFIG_AND_ENV.md (all 14 vendor accounts to provision)
3. PRODUCTION_ARCHITECTURE.md §Hosting and §Security

Generate a paste-ready ops runbook for L1 that covers all 14 vendor accounts.
For each: exact account type, EU residency requirement, env var(s) it provides,
where to put the secret (vault path), and the validation step that proves it works.
Format as a numbered checklist suitable for a non-developer ops team member.
Include the `make db-harden` step and the config validator production-run command.
Do not start L2 — that is a build task that follows L1 completion.
```

---

## Key non-negotiables (read CLAUDE.md for the full list)

- `MFA_REQUIRED=true` in production. Config validator enforces. No bypass.
- Staff JWT (`aud:ns.staff`) never accepted on patient endpoints.
- `audit_log` append-only at DB layer (trigger + REVOKE). Rows never deleted.
- Machine-translated CS/PL/HU/UK clinical content: always draft until human-approved via `/admin/translations`.
- **Translations are automated via Google Cloud Translation v3 + medical glossary.** The review queue is a proofreading/approval step before publish — not a manual translation job.
- No patient RC in plaintext. `patientRcHash` (bcrypt) for checks; `patientRcEncrypted` (AES-256-GCM) for NCZI/GDPR export.
- No direct web → HIS DB writes. All HIS events via RabbitMQ → sync agent → HL7/FHIR.
- FHIR-linked wearable readings never deleted (Act 362/2011 legal hold).
- EU hosting only (Decree 179/2020). No data outside EU infrastructure.
- `WEARABLES_ENABLED=false` until §L9 gate passes.
- `OIDC_MOCK_ENABLED=false`, `HIS_MOCK_ENABLED=false`, `WEARABLES_PROVIDER=live` only after L1.
- WCAG 2.1 AA — zero axe critical/serious on all routes.
- `pnpm` only. Never `npm install` or `yarn`.
- No physicians table — physician–patient via `TelehealthSession`.
- `z.coerce.boolean()` is banned — use `strictBool(default)` pattern from A1 security fix.

---

## Recommended execution order

```
1. Merge A1 → A2 → A3 to main (fast-forward, in order)
2. Get W2/W3 done-when reports → verify → merge both
3. Sprint WL9 (Redis OAuth state, cron jobs, §L9 gate verification)
4. Sprint L1-PREP (ops runbook for 14 vendor accounts)
5. L1 (ops: provision accounts, inject secrets, config validator passes in production)
6. L2 (build: EU staging + integration smoke)
7. L3 (build: full CI suite green on staging)
8. L4/L5/L6 (ops: backup, monitoring, pen-test) — parallel with L7
9. L7 (build+staff: content review, real photos, CS/PL/HU/UK translations approved via /admin/translations)
10. L8 (build: GDPR launch records)
11. L9 (joint: go/no-go → FRO soft-launch → full launch)
```

---

## Project Overview reference

`Project Overview.html` at the project root is a living HTML document covering full build status, architecture decisions, non-negotiables, language roadmap, gap list, and launch gate status. Open it in the browser for a current view before starting any sprint.
