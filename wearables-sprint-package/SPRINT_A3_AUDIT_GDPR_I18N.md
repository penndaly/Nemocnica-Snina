# Sprint A3 — Audit Log, GDPR Data Tools & Translation Review Gate
## Nemocnica Snina · Admin Backend Production Wiring

**Branch:** `feature/admin-a3-audit-gdpr-i18n`
**Depends on:** A2 ✅ merged (staff auth, RBAC, audit_log table created)
**Design prototypes:** `admin.html` (Disclosures, Tools, role descriptions) · `Admin User Guide.html` §13 (translations) · §17 (roles) · §16 (tools)
**Legal refs:** GDPR Art. 5(2) · 15 · 17 · 21; Act 351/2022 (WCAG AA); Decree 179/2020 (EU hosting, TLS 1.3)

---

## Paste this into Claude Code before starting

```
Read the following files in full before writing any code:

1. admin.html (Tools section, role descriptions, the export/import/reset buttons)
2. Admin User Guide.html §13 (translations & review gate) §16 (tools) §17 (roles)
3. assets/data.js SEED — bilingual field structure (all { sk, en })
4. PRODUCTION_ARCHITECTURE.md §GDPR §Compliance §Audit
5. apps/api/src/ — the full api source tree (understand existing module patterns)
6. apps/api/prisma/schema.prisma (audit_log table added in A2 — extend here)
7. apps/web/src/messages/sk.json + en.json (i18n string structure)

Execute Sprint A3 only. Stop and report Done-when criteria before Sprint W4 or any further sprints.
```

---

## Non-negotiables

- `audit_log` is append-only at the DB layer. `REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC` was applied in A2. A3 adds the trigger and verifies the constraint is live.
- GDPR Art. 17 erasure: never hard-delete `audit_log` rows — anonymise `actor_name` and `meta` PII only.
- Machine-translated clinical content (CS/PL/HU/UK) is **always a draft**. A lifecycle hook blocks Strapi `publish` if `review_status !== 'approved'` for those locales. No bypass.
- GDPR data export (Art. 15) and erasure (Art. 17) are administrator-only. Super admin only.
- Data export/erasure requests are logged in `audit_log` with `action='gdpr_export'` / `'gdpr_erasure'`.
- All audit log queries are read-only; no admin user can delete or modify audit entries.
- Export files are AES-256-GCM encrypted at rest; ephemeral signed URLs (5 min TTL) for download; deleted from storage after download or 1 hour, whichever is first.
- EU hosting only (Decree 179/2020). Export files must never transit outside EU infrastructure.

---

## Part A — Audit log hardening (`apps/api/prisma/`)

```sql
-- Verify the append-only constraint from A2 is active:
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'audit_log';
-- Expected: no UPDATE or DELETE grants for any non-superuser role.

-- Add DB-level trigger as a second layer of protection:
CREATE OR REPLACE FUNCTION audit_log_no_mutate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. Modification is not permitted.';
END;
$$;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_no_mutate();

-- Index for common query patterns:
CREATE INDEX idx_audit_log_actor    ON audit_log (actor_id, ts DESC);
CREATE INDEX idx_audit_log_action   ON audit_log (action, ts DESC);
CREATE INDEX idx_audit_log_target   ON audit_log (target_type, target_id, ts DESC);
```

### A3.1 — Audit service (`apps/api/src/audit/audit.service.ts`)

```typescript
// Centralised audit writer — used by CMS, auth, GDPR, admin-users modules.
// All A2 modules were writing directly to the table; A3 routes through this service.

writeAuditEntry(entry: AuditEntryDto): Promise<void>
  // AuditEntryDto:
  // { actorId?, actorName?, action, targetType?, targetId?, meta?, ipAddress?, userAgent? }
  // Validates that action is in the ALLOWED_ACTIONS set (prevents arbitrary strings).
  // Strips PII from meta before writing (see §PII rules below).

// ALLOWED_ACTIONS (extend as modules add new ones):
const ALLOWED_ACTIONS = new Set([
  // Auth
  'staff_login_attempt', 'staff_login_success', 'staff_mfa_failure', 'staff_logout',
  'mfa_setup_complete', 'mfa_reset_issued', 'invite_sent', 'invite_accepted',
  'password_reset_issued', 'password_reset_complete', 'sessions_revoked',
  // Staff accounts
  'staff_account_created', 'staff_account_updated', 'staff_account_deleted',
  'scopes_updated', 'role_changed',
  // CMS content
  'content_created', 'content_updated', 'content_deleted', 'content_published',
  'content_unpublished',
  // Translation
  'translation_reviewed', 'translation_approved', 'translation_rejected',
  // GDPR
  'gdpr_export_requested', 'gdpr_export_downloaded', 'gdpr_erasure_requested',
  'gdpr_erasure_completed', 'gdpr_data_request_closed',
  // Wearables (from W4/W5)
  'wearable_alert_critical', 'wearable_alert_batch',
  'threshold_updated', 'consent_granted', 'consent_withdrawn',
  // Telehealth
  'session_scheduled', 'session_cancelled', 'session_joined', 'session_ended',
]);

// PII stripping rules for meta field:
// - Never write patient RC (national ID) — replace with SHA-256 hash if present.
// - Never write passwords, tokens, or secrets.
// - patient_token: only first 8 chars allowed (e.g. "PT-84A2…").
// - email addresses in meta: hash with SHA-256.
```

### A3.2 — Audit log API (`apps/api/src/audit/audit.controller.ts`)

```typescript
// Routes: /api/audit/
// GET /api/audit/?action=&actorId=&targetType=&targetId=&from=&to=&page=&limit=
//   Role: administrator | super_admin
//   Returns: paginated audit_log entries, newest first.
//   Max 200 rows per page.
//   Filtered by any combination of: action, actorId, targetType, targetId, date range.

// GET /api/audit/staff/:staffId
//   Role: administrator | super_admin
//   Returns: all audit entries for a specific staff member (last 500).

// GET /api/audit/content/:targetType/:targetId
//   Role: administrator | super_admin
//   Returns: full change history for a specific content item.
//   Used in admin UI "View history" panel per content row.
```

### A3.3 — Audit log in admin.html

```
Add "View history" icon button to each list row (alongside edit + delete).
Opens a read-only slide-in panel (right side, 420px wide):

  ─── Change history — Surgery & Traumatology ───────────
  ● 2024-11-15 14:32   Tomáš Kováč (editor)
    content_updated  · beds: 42 → 47; visiting changed

  ● 2024-11-10 09:14   Jana Borščová (clinician)
    content_updated  · summary.sk updated

  ● 2024-10-01 11:00   System seed
    content_created

  [Load older entries]

Calls: GET /api/audit/content/department/chirurgia
Format timestamps in active language (sk-SK or en-GB).
No edit/delete controls — read-only view.
```

---

## Part B — GDPR data tools (`apps/api/src/gdpr/`)

These tools are available to `super_admin` and `administrator` roles only. Every action writes an `audit_log` entry.

### B1 — Patient data export (GDPR Art. 15 — right of access)

```typescript
// POST /api/gdpr/patient/export
// Body: { patientToken: string, requestedBy: string, requestReference: string }
// Role: super_admin | administrator

exportPatientData(patientToken: string): Promise<{ downloadUrl: string, expiresAt: Date }>

// Steps:
// 1. Validate patientToken exists (portal_patients table).
// 2. Collect all patient data across tables:
//    - portal_patients (name, dob, blood, insurance)
//    - patient_conditions, patient_meds, patient_labs, patient_appointments
//    - device_consents (wearable consent records)
//    - device_readings (all readings with consent)
//    - consent_audit_log (full consent change history)
//    - portal_notifications (all wearable alerts)
//    - telehealth_sessions (session metadata — no recordings)
//    - audit_log WHERE meta @> { patient_token: patientToken } (all actions affecting patient)
// 3. Serialise to GDPR-compliant JSON (machine-readable, Art. 20 portability format).
// 4. AES-256-GCM encrypt the JSON bundle.
// 5. Upload to S3-compatible EU bucket (GDPR_EXPORT_BUCKET env var).
// 6. Generate signed URL (5 min TTL).
// 7. audit_log: action='gdpr_export_requested', meta={ patientToken[:8], requestReference }
// 8. Return { downloadUrl, expiresAt }.
// 9. Schedule S3 object deletion after 1 hour.

// GET /api/gdpr/patient/export/:requestId/download
// Validates signed URL not expired; logs 'gdpr_export_downloaded'; streams file.
// File deleted from S3 on successful download.
```

### B2 — Patient data erasure (GDPR Art. 17 — right to erasure)

```typescript
// POST /api/gdpr/patient/erasure
// Body: { patientToken: string, reason: string, requestReference: string }
// Role: super_admin only (not administrator — erasure is irreversible)

erasePatientData(patientToken: string, reason: string): Promise<ErasureReceiptDto>

// Steps:
// 1. Validate patientToken exists.
// 2. Check no active telehealth sessions or pending appointments (abort if yes).
// 3. Check wearable readings with fhir_observation_id set:
//    - These CANNOT be erased (FHIR records are legally required by Act 362/2011).
//    - Anonymise patient_token reference in device_readings but preserve the observation.
//    - Include list of preserved FHIR observation IDs in receipt.
// 4. Hard-delete: device_readings (without fhir_observation_id), device_consents,
//    portal_notifications, patient_conditions, patient_meds, patient_labs,
//    patient_appointments, portal_patients.
// 5. Soft-anonymise audit_log: WHERE meta @> { patient_token: patientToken }
//    → UPDATE meta = meta - 'patient_token' || '{"patient_token":"[erased]"}' 
//    Note: audit_log trigger allows UPDATE of meta column ONLY for GDPR erasure
//    (special DB function with SECURITY DEFINER — see migration).
// 6. Revoke OAuth tokens for all connected wearable devices.
// 7. Generate erasure receipt (JSON): { timestamp, requestReference, erasedTables[],
//    preservedFhirObservations[], reason }.
// 8. AES-256-GCM encrypt receipt; store in S3 with 10-year retention.
// 9. audit_log: action='gdpr_erasure_completed', meta={ requestReference, preservedCount }
// 10. Return ErasureReceiptDto (download URL for encrypted receipt, 5 min TTL).

// NOTE: audit_log rows themselves are never deleted — only meta PII anonymised.
// The audit_log immutability trigger has a single EXCEPTION for the GDPR erasure
// function (SECURITY DEFINER), which is scoped to meta-only updates.
```

### B3 — Staff data export / erasure (GDPR for staff accounts)

```typescript
// POST /api/gdpr/staff/export/:staffId
// Exports staff account data: profile, audit history, sessions.
// Role: super_admin only.

// POST /api/gdpr/staff/erasure/:staffId
// Anonymises staff account on departure:
//   - email → 'deleted-{id}@ns.internal'
//   - name → 'Deleted User'
//   - password_hash, totp_secret, recovery_codes → NULL
//   - status → 'disabled'
//   - audit_log: actor_name denormalised values → preserved (legal requirement)
//   - audit_log: actor_id → preserved (for chain of custody)
// This is separate from DELETE /api/admin/users/:id (which is soft-disable only).
// Role: super_admin only.
```

### B4 — GDPR admin UI panel in `admin.html`

```
Add under Settings nav group (super_admin / administrator only):

  GDPR-Tools
  [shield icon] Správa dát GDPR  (Data Management)

GDPR panel view:

  ── Patient data requests ─────────────────────────────────────────
  [Request reference]  [Patient token (first 8)]  [Type]  [Requested by]

  New request form:
    Patient token:  [input]
    Request ref:    [input — e.g. GDPR-2024-001]
    Requested by:   [input — name of DPO/admin handling]
    Type:           [Export (Art.15)] / [Erasure (Art.17)]
    Reason (erasure only): [textarea]
    [Submit request]

  After export: download button appears (5 min TTL). "Download the file immediately."
  After erasure: receipt download appears. "Store the receipt securely."

  ── Staff account data ────────────────────────────────────────────
  [Staff member dropdown]
  [Export staff data]  [Anonymise on departure]

  ── Audit log viewer ─────────────────────────────────────────────
  (Full audit log — read-only table, all accounts, all actions)
  Filters: action | staff member | date range | target type
  Export audit log to CSV (for DPO review).
```

---

## Part C — Translation review gate

### C1 — Strapi lifecycle hook

```typescript
// apps/cms/src/extensions/content-manager/lifecycle-hooks.ts

// Applies to all clinical collections:
// department, clinic, physician, service, facility, news-item

const CLINICAL_COLLECTIONS = ['department','clinic','physician','service','facility','news-item'];
const MACHINE_TRANSLATED_LOCALES = ['cs','pl','hu','uk'];

// beforePublish hook:
async beforePublish({ model, entry }) {
  if (!CLINICAL_COLLECTIONS.includes(model.uid)) return; // non-clinical: pass through
  const locale = entry.locale;
  if (!MACHINE_TRANSLATED_LOCALES.includes(locale)) return; // SK/EN: pass through
  if (entry.review_status !== 'approved') {
    throw new ApplicationError(
      `Cannot publish ${locale} content without review_status='approved'. ` +
      `A reviewer must approve this translation before it can go live. ` +
      `(GDPR/clinical safety requirement — see Admin User Guide §14.)`
    );
  }
}
```

### C2 — Translation fields (add to all clinical content types)

```typescript
// Add to each clinical collection type in Strapi:
review_status   Enumeration  'needs_review' | 'approved' | 'rejected'  default: 'needs_review'
reviewed_by     String        reviewer name; set when status changes to 'approved'/'rejected'
reviewed_at     DateTime      set when status changes
review_notes    Text          optional notes from reviewer (e.g. "corrected dosage term")

// These fields only appear in the admin UI for machine-translated locales (CS/PL/HU/UK).
// SK and EN do not show review fields (they are human-authored).
```

### C3 — Translation management API

```typescript
// Routes: /api/cms/translations/
// Role: editor | clinician | administrator | super_admin

// GET /api/cms/translations/pending
//   Returns all content items across all clinical collections
//   where locale IN ('cs','pl','hu','uk') AND review_status = 'needs_review'.
//   Groups by collection; counts per locale.
//   Used to show the review queue badge in admin nav.

// PUT /api/cms/translations/:collection/:id/:locale/review
//   Body: { status: 'approved' | 'rejected', notes?: string }
//   Updates review_status, reviewed_by, reviewed_at.
//   If 'approved': triggers Strapi publish for that locale entry.
//   If 'rejected': keeps as draft; reviewer must edit and re-submit.
//   audit_log: action='translation_reviewed', meta={ collection, slug, locale, status }

// GET /api/cms/translations/:collection/:id
//   Returns all locales for a content item with their review status.
//   Used in the editor to show the translation review panel.
```

### C4 — Translation review UI in `admin.html`

```
Add to nav rail (all roles):

  OBSAH / CONTENT
  ... (existing collections)
  [globe icon]  Preklady  (Translations)  [badge: N pending]

Translation review list:

  ── Needs review ─────────────────────────────────────────────────
  Filter: [All] [CS] [PL] [HU] [UK]

  Departments (2 pending)
  ┌────────────────────────────────────────────────────────────────┐
  │ Surgery & Traumatology  [CS]  needs review   [Review]  [Skip] │
  │ Internal Medicine       [HU]  needs review   [Review]  [Skip] │
  └────────────────────────────────────────────────────────────────┘

  Clinics (1 pending)
  ┌────────────────────────────────────────────────────────────────┐
  │ Urology Clinic          [PL]  needs review   [Review]  [Skip] │
  └────────────────────────────────────────────────────────────────┘

Review editor (side-by-side diff view):

  ┌─────────────────────────┬─────────────────────────────────────┐
  │  SK (original)          │  CS (machine translation)           │
  ├─────────────────────────┼─────────────────────────────────────┤
  │  Chirurgicko-           │  Chirurgicko-traumatologické        │
  │  traumatologické        │  oddělení poskytuje komplexní...    │
  │  oddelenie...           │                                     │
  └─────────────────────────┴─────────────────────────────────────┘

  [Edit CS translation directly in right panel]

  Review notes (optional): [textarea]

  [✓ Approve & publish]   [✗ Reject]   [← Back to queue]

Badge behaviour:
  Admin nav shows total pending count across all locales.
  Clears per-locale as items are approved/rejected.
```

---

## Part D — CMS Tools hardening (replacing prototype tools)

The prototype `admin.html` Tools section (Export, Import, Reset) uses `localStorage`. Replace with production equivalents.

```typescript
// POST /api/cms/tools/export
//   Role: administrator | super_admin
//   Exports all published content (all collections + singletons) as JSON.
//   AES-256-GCM encrypted. Signed URL (5 min). Max file size 50 MB.
//   audit_log: action='content_export'

// POST /api/cms/tools/import
//   Role: super_admin only
//   Body: multipart/form-data — exported JSON file
//   Validates structure against ADMIN.SCHEMAS before writing.
//   Runs in a transaction — all-or-nothing.
//   Does NOT reset physician photos or disclosure PDFs (media stays).
//   audit_log: action='content_import', meta={ itemCounts }

// POST /api/cms/tools/reset
//   Role: super_admin only
//   Confirmation: requires body { confirm: 'RESET_ALL_CONTENT', password: string }
//   (extra password re-entry prevents accidental clicks)
//   Resets all content collections to SEED_VERSION=8 data.
//   Does NOT reset staff accounts, audit log, patient data, or media files.
//   audit_log: action='content_reset'
```

---

## Part E — WCAG AA compliance sweep (all admin + public pages)

```
Run axe-core against every route. Fix all critical/serious violations before launch.
Target pages:
  Public: / · /oddelenia · /oddelenia/:slug · /ambulancie · /lekari · /lekari/:slug
          /sluzby · /diagnostika · /aktuality · /objednanie · /zverejnovanie · /kontakt
  Portal: /portal (all tabs) · /portal/wearables · /portal/wearables/sublas
  Admin:  /admin (all sections) · /admin/users (super admin)

Key checks:
  - All form fields have <label> or aria-label
  - All icon buttons have aria-label or title
  - All modals: role="dialog" aria-modal="true" aria-labelledby; Esc closes; focus trapped
  - Colour contrast: 4.5:1 for normal text; 3:1 for large text
  - Skip link: <a href="#main-content"> at start of every page
  - All images: meaningful alt text or alt="" for decorative
  - Language attribute: html[lang] correct per locale
  - Keyboard navigation: all interactive elements reachable and operable by keyboard
  - axe must return zero critical/serious on all routes.
```

---

## Part F — Environment variables added by A3

```env
# GDPR export storage
GDPR_EXPORT_BUCKET=ns-gdpr-exports-eu      # EU S3-compatible bucket
GDPR_EXPORT_KEY=                            # AES-256-GCM key (32-byte hex)
GDPR_EXPORT_URL_TTL_SECONDS=300             # 5 min signed URL TTL
GDPR_EXPORT_RETENTION_HOURS=1              # delete from S3 after 1 hour if not downloaded

# Translation
MT_PROVIDER=deepl                          # 'deepl' | 'mock' (mock in dev/CI)
MT_DEEPL_API_KEY=
MT_TARGET_LOCALES=cs,pl,hu,uk
MT_GLOSSARY_ID=                            # DeepL glossary ID for medical/hospital terms
```

---

## Part G — Tests

```typescript
// Unit tests (audit.service.spec.ts):
// - writeAuditEntry: unknown action → throws ValidationError
// - writeAuditEntry: meta with full patient RC → RC stripped / hashed before write
// - writeAuditEntry: meta with email → email hashed before write
// - DB trigger: direct UPDATE on audit_log → raises exception

// Unit tests (gdpr.service.spec.ts):
// - exportPatientData: returns signed URL; S3 object exists
// - exportPatientData: unknown patientToken → 404
// - erasePatientData: readings with fhir_observation_id → preserved; without → deleted
// - erasePatientData: active telehealth session → 409 Conflict
// - erasePatientData: audit_log meta anonymised; audit_log rows NOT deleted

// Unit tests (translation.service.spec.ts):
// - beforePublish: CS content with review_status='needs_review' → throws error
// - beforePublish: CS content with review_status='approved' → passes
// - beforePublish: SK content (any review_status) → passes
// - approveTranslation: sets review_status='approved'; Strapi publishes locale entry
// - rejectTranslation: sets review_status='rejected'; does NOT publish

// E2E (Playwright):
// A3-1  Attempt to publish CS translation of 'surgery' department without approval → blocked.
// A3-2  Approve CS translation → content appears at /cs/oddelenia/chirurgia.
// A3-3  Super admin requests patient data export → JSON bundle downloaded (encrypted).
// A3-4  Super admin requests erasure → patient rows gone; fhir rows preserved; receipt downloaded.
// A3-5  Direct DB UPDATE on audit_log → trigger fires exception (psql test).
// A3-6  GET /api/audit/?action=staff_login_success → returns entries; editor role → 403.
// A3-7  axe: zero critical/serious on /admin, /admin?section=users, /lekari, /lekari/borscova.
// A3-8  Content export (super admin) → JSON file; import same file → content restored.
// A3-9  Content reset (super admin) with wrong confirm string → 422; correct → seed restored.
```

---

## Done when

- [ ] Audit log DB trigger blocks UPDATE/DELETE (A3-5 green)
- [ ] `AuditService` routes all audit writes through central service with PII stripping
- [ ] Translation lifecycle hook blocks CS/PL/HU/UK publish without `review_status='approved'` (A3-1 green)
- [ ] Translation review queue in admin.html: pending badge, side-by-side diff, approve/reject
- [ ] Approved translations go live in correct locale (A3-2 green)
- [ ] GDPR patient data export: encrypted JSON bundle, signed URL, deleted after download (A3-3 green)
- [ ] GDPR patient erasure: correct tables erased, FHIR rows preserved, receipt generated (A3-4 green)
- [ ] GDPR admin UI panel in `admin.html` (export, erasure, audit viewer, CSV export)
- [ ] CMS export/import/reset wired to API (not localStorage)
- [ ] axe: zero critical/serious on all admin + public + portal routes (A3-7 green)
- [ ] A3-1 through A3-9 green
