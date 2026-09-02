# Sprint A4 — Merge Runbook, Booking Management & Wearables Admin Panel
## Nemocnica Snina · Admin Backend

**Branch (merge):** fast-forward `feature/wearables-wl9` → `main`
**Branch (A4):** `feature/admin-a4-booking-wearables`
**Depends on:** A3 ✅ merged · W2/W3/WL9 ✅ committed on `feature/wearables-wl9`
**Design refs:** `admin.html` · `portal.html` (wearables tab) · `wearables-connect-alerts.html`
**Seed data:** `assets/data.js` `SEED` — clinic schedules + booking rules (source of truth for slot shapes)

---

## Part A — Merge runbook (do this before any A4 code)

Complete in order. Do not start A4 code until all merge validation steps are green.

### A.1 — Pre-merge checklist

```bash
# Verify commit order on branch (WL9 → W2 → W3):
git log --oneline feature/wearables-wl9
# Expected (newest first):
# 6a47051  feat(wearables): W3 consumer adapters — Fitbit, Garmin, Google Health, Samsung + stubs + Xiaomi
# bb24c96  feat(wearables): W2 medical adapters — AdapterRegistry + Abbott Libre, Dexcom, Withings, Omron
# 3e1ba37  feat(wearables): WL9 compliance gate — Redis OAuth state, batch-alert digest, retention crons

# Baseline must match pre-merge:
cd apps/api && pnpm test
# Expect: 301 passed, 5 infra-gated skipped (booking timezone, *.db, telehealth-session, *.e2e)

cd apps/api && tsc --noEmit
# Expect: clean
```

### A.2 — Catalog fix (commit on branch before merging)

In `apps/api/src/wearables/catalog/adapter-catalog.ts` (or equivalent catalog file):

```diff
-  { id: 'medtronic_cgm', partnershipRequired: false, ... }
+  { id: 'medtronic_cgm', partnershipRequired: true, ... }
```

```bash
git add apps/api/src/wearables/catalog/
git commit -m "fix(wearables): correct medtronic_cgm partnershipRequired flag — was false, must be true; connect is blocked one step later otherwise"
```

### A.3 — Merge

**Option A — fast-forward (recommended; preserves discrete commits per sprint):**

```bash
git checkout main
git merge --ff-only feature/wearables-wl9
git push origin main
```

**Option B — split into separate branches first (cleaner PR history):**

```bash
git checkout main

git checkout -b feature/wearables-wl9-only && git cherry-pick 3e1ba37
git push origin feature/wearables-wl9-only
# → merge PR, then:

git checkout main && git pull
git checkout -b feature/wearables-w2 && git cherry-pick bb24c96
git push origin feature/wearables-w2
# → merge PR, then:

git checkout main && git pull
git checkout -b feature/wearables-w3 && git cherry-pick 6a47051
git push origin feature/wearables-w3
# → merge PR
```

Either option is valid. Flag the choice to the team before executing — it affects PR review history only, not the running code.

### A.4 — Post-merge validation

```bash
cd apps/api && pnpm test          # expect: 301 passed (unchanged)
cd apps/api && tsc --noEmit       # expect: clean
cd apps/web && pnpm typecheck     # expect: same pre-existing noise only (lekari, registracia,
                                  #         styleguide, sitemap, e2e, playwright.config)
                                  #         — no new failures
```

If all green: update `Project Overview.html` — change W2, W3, WL9 from "Committed" to "On main".

### A.5 — New env vars (add to `apps/api/.env.example`)

```env
# W2 — Medical adapters (leave blank until L1 vendor credentials provisioned)
LIBRE_CLIENT_ID=
LIBRE_CLIENT_SECRET=
LIBRE_REGION=eu
DEXCOM_CLIENT_ID=
DEXCOM_CLIENT_SECRET=
DEXCOM_SANDBOX=true
WITHINGS_CLIENT_ID=
WITHINGS_CLIENT_SECRET=
OMRON_CLIENT_ID=
OMRON_CLIENT_SECRET=
KARDIA_API_KEY=

# W3 — Consumer adapters
FITBIT_CLIENT_ID=
FITBIT_CLIENT_SECRET=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
GARMIN_WEBHOOK_KEY=
GOOGLE_HEALTH_CLIENT_ID=
GOOGLE_HEALTH_CLIENT_SECRET=
SAMSUNG_HEALTH_CLIENT_ID=
SAMSUNG_HEALTH_CLIENT_SECRET=
XIAOMI_IMPORT_MAX_FILE_SIZE_MB=10
# APPLE_HEALTH_BUNDLE_ID and APPLE_TEAM_ID stay blank until iOS app is built
# HUAWEI: no credentials — hard-blocked at config level until EU Adequacy Decision
```

---

## Paste this into Claude Code before starting (A4)

```
Read the following files in full before writing any code:

1. admin.html — understand the nav structure, list views, slide-in panel, and modal patterns exactly
2. assets/admin.js — SCHEMAS (7 collections) + SINGLETONS; use exact field names; do not invent
3. assets/data.js SEED — clinic objects (bookingRules, slots, bookable flags) are the slot model
4. portal.html — Wearables tab (device status cards, alert badge, notification bell)
5. wearables-connect-alerts.html — device status states (connected, error, partnership, ios, upload)
6. apps/api/src/wearables/ — full wearables module; understand adapter catalog, alert engine, consent
7. apps/api/src/auth/ — StaffJwtGuard, ScopeGuard, StaffRolesGuard patterns (A2)
8. apps/api/src/audit/audit.service.ts — AuditService; ALL mutations must write an entry
9. apps/api/src/booking/ or apps/api/src/appointments/ — existing booking service and rules

Execute Sprint A4 only. Stop and report Done-when criteria before starting L1-PREP.
```

---

## Non-negotiables

- All mutations (cancel booking, reschedule, threshold update, platform toggle) write an `audit_log` entry via `AuditService`.
- Booking rules remain enforced server-side. Admin cancel/reschedule routes use the same `BookingRulesService` — they are not a bypass.
- Wearables platform credentials (`client_id`, `client_secret`, `consumer_key`, etc.) are **write-only in the UI**. API responses return `credentialsConfigured: boolean` only — never the actual value.
- Access scopes (A2): `clinician` role sees only bookings for their scoped department/clinic/physician. `editor` role has no access to booking or wearables admin views.
- Global alert threshold defaults set a fallback only. Physician-level thresholds (W5 `device_alert_thresholds` table) always take precedence — do not override them.
- Patient tokens displayed as first 8 chars + ellipsis (e.g. `PT-84A2…`). No patient name, RC, or full token in any admin UI.
- All new admin UI sections must pass axe WCAG 2.1 AA (zero critical/serious) before marking done.

---

## Part B — Booking & appointment management

A1 wired clinic + physician CMS collections. No sprint has yet built the admin view of patient bookings — the queue of upcoming appointments, cancellations, and no-shows.

### B1 — Booking management API (`apps/api/src/booking/booking-admin.controller.ts`)

```typescript
// All routes under /api/admin/bookings/
// Minimum roles: clinician (own scope), administrator, super_admin

// GET /api/admin/bookings/
//   Query: { clinicId?, departmentId?, physicianId?, status?, date?, page?, limit=50 }
//   Returns: paginated BookingAdminItemDto[]
//   BookingAdminItemDto: {
//     id, patientTokenPreview (first 8 chars), clinicId, clinicName,
//     physicianId?, physicianSlug?, slot (ISO datetime), durationMin,
//     status: 'booked'|'cancelled'|'no_show'|'completed'|'pending',
//     paymentStatus: 'free'|'paid'|'refunded'|'pending',
//     bookedAt, updatedAt
//   }
//   ScopeGuard: clinician role filtered to their scoped clinic/department IDs.

// GET /api/admin/bookings/stats
//   Returns: {
//     today: { booked: N, cancelled: N, noShow: N, completed: N },
//     week:  { booked: N, cancelled: N, noShow: N },
//     pendingReview: N   // status='pending' requiring manual confirmation
//   }
//   Used for dashboard summary cards.

// POST /api/admin/bookings/:id/cancel
//   Body: { reason: string, notifyPatient?: boolean (default true) }
//   Roles: clinician (own scope), administrator, super_admin
//   Validation:
//     - Booking must exist and not already be cancelled/completed.
//     - Slot must be in the future (cannot cancel a past appointment).
//     - BookingRulesService.validateCancellation(booking) — same server-side rules as portal.
//   Side effects:
//     - status → 'cancelled'
//     - If notifyPatient: queue SMS job + create portal_notification (type='booking_cancelled')
//     - If paymentStatus='paid' AND slot > now + refundWindowHours (from clinic booking rules):
//         queue payment refund job
//   audit_log: action='booking_cancelled', meta={ bookingId, clinicId, slotIso, reason,
//              notifyPatient, refundQueued: boolean }

// POST /api/admin/bookings/:id/reschedule
//   Body: { newSlotId: string, reason?: string }
//   Roles: administrator, super_admin (not clinician — scope too narrow for cross-slot moves)
//   Validation:
//     - New slot must be in the same clinic.
//     - BookingRulesService.validateSlotAvailability(newSlotId) — not full, not past, not blocked.
//   Side effects:
//     - Updates booking slot; status stays 'booked'
//     - Queues SMS + portal_notification (type='booking_rescheduled', includes new slot)
//   audit_log: action='booking_rescheduled', meta={ bookingId, oldSlot, newSlot, reason }

// POST /api/admin/bookings/:id/no-show
//   Roles: clinician (own scope), administrator, super_admin
//   Validation: slot must be in the past or within 30 min of start.
//   Side effects:
//     - status → 'no_show'; no refund (no-show policy)
//     - Queues portal_notification (type='no_show_recorded') — no SMS by default
//   audit_log: action='booking_no_show', meta={ bookingId, clinicId, slotIso }
```

### B2 — Booking management UI in `admin.html`

Match the visual patterns of the existing list views (departments, clinics) exactly.

```
Add to nav rail under OBSAH / CONTENT group
(visible to: clinician, administrator, super_admin — not editor):

  [calendar icon]  Objednania  (Appointments)

──────────────────────────────────────────────────────────────────────
Appointments view
──────────────────────────────────────────────────────────────────────

Stats row (4 cards, same card pattern as admin dashboard):
  ┌──────────────┬──────────────┬──────────────┬──────────────┐
  │ Today        │ This week    │ Pending      │ No-shows     │
  │ 14 booked   │ 67 booked   │ 3 review    │ 2 today     │
  └──────────────┴──────────────┴──────────────┴──────────────┘

Filters (row above table):
  [All clinics ▼]  [All statuses ▼]  [Date: today ↔ +7d]  [Search slot/clinic]

Table columns:
  Patient token  │ Clinic              │ Physician        │ Slot              │ Status   │ Payment  │ [⋯]
  PT-84A2…       │ Urology             │ MUDr. Horváth    │ 25 Jun 09:00      │ booked   │ paid     │
  PT-2F91…       │ FRO                 │ MUDr. Borščová   │ 25 Jun 10:30      │ booked   │ free     │
  PT-8C34…       │ Internal medicine   │ —                │ 26 Jun 08:00      │ pending  │ paid     │

Status badges: booked (blue) · completed (green) · cancelled (gray) · no_show (amber) · pending (yellow pulse)

Row action menu [⋯]:
  Cancel appointment…
  Reschedule…          (administrator+ only)
  Mark as no-show
  ─────
  View audit history   (opens existing audit history panel from A3)

Cancel modal:
  Title: "Zrušiť objednanie / Cancel appointment"
  "Dôvod zrušenia / Reason for cancellation"  [textarea, required, min 10 chars]
  ☑ "Notifikovať pacienta / Notify patient via SMS + portal"  (default checked)
  ☑ "Vrátiť platbu / Refund payment"  (shown only when paymentStatus='paid' AND within refund window)
  [Zrušiť objednanie / Cancel]  [Späť / Back]

Reschedule modal (administrator+):
  "New slot" date-time picker (free-text ISO or slot selector from clinic availability)
  "Reason (optional)" [input]
  [Reschedule]  [Back]

No-show: immediate with confirmation popover ("Mark PT-84A2… as no-show for 09:00 slot?")
```

---

## Part C — Wearables admin panel

W2/W3 shipped 8 live adapters and a full adapter catalog. No admin sprint has yet built:
(a) visibility into which platforms are configured/enabled,
(b) an aggregate view of device connections and alert history, or
(c) global default thresholds as a fallback for patients without physician-set values.

### C1 — Platform management API (`apps/api/src/wearables/wearables-admin.controller.ts`)

```typescript
// Routes: /api/admin/wearables/platforms/
// Role: super_admin only (credentials are sensitive; platform toggles affect all patients)

// GET /api/admin/wearables/platforms/
//   Returns: PlatformStatusDto[] for every entry in adapter catalog:
//   {
//     id, name, category: 'medical'|'consumer',
//     partnershipRequired: boolean,
//     enabled: boolean,           // currently shown in connect flow
//     credentialsConfigured: boolean,  // true if required env vars are set and non-empty
//     connectedDeviceCount: number,    // count of wearable_devices rows with this platform_id
//     lastSyncAt: Date | null,         // most recent sync_jobs entry for this platform
//     connectionTestUrl: string | null // OAuth discovery URL for ping test (null if partnership/blocked)
//   }
//   Credentials themselves are never returned.

// PUT /api/admin/wearables/platforms/:platformId/enabled
//   Body: { enabled: boolean }
//   Role: super_admin
//   Writes platform override to a wearable_platform_overrides table (id, enabled, updatedAt, updatedBy).
//   Takes effect within 60 seconds (AdapterRegistry checks on next request).
//   Cannot enable a partnership_required platform (returns 422: 'partnership_required').
//   Cannot enable Huawei (returns 422: 'eu_adequacy_blocked').
//   audit_log: action='wearable_platform_toggled', meta={ platformId, enabled, previousState }

// POST /api/admin/wearables/platforms/:platformId/test
//   Role: super_admin
//   Performs a lightweight GET on the platform's OAuth discovery / token endpoint.
//   Returns: { ok: boolean, latencyMs: number, httpStatus?: number, error?: string }
//   Times out after 5 seconds. Does not create any device or token — infra health only.
//   Not logged to audit_log (read-only health check).

// DB migration: wearable_platform_overrides
//   id            String   @id @default(cuid())
//   platform_id   String   @unique
//   enabled       Boolean
//   updated_at    DateTime @updatedAt
//   updated_by    String   (staff actor_id)
```

### C2 — Monitoring & alert log API (`apps/api/src/wearables/wearables-monitoring.controller.ts`)

```typescript
// Routes: /api/admin/wearables/monitoring/
// Role: administrator | super_admin

// GET /api/admin/wearables/monitoring/summary
//   Returns: {
//     totalConnected: number,
//     byPlatform: { [platformId]: { connected: number, syncErrors: number } },
//     consentExpiringSoon: number,   // device_consents expiring within 30 days
//     consentGracePending: number,   // wearable_devices with sync_status='suspended' from WL9 cron
//     pendingAlerts: number          // portal_notifications with type LIKE 'wearable_alert%' AND read_at IS NULL
//   }

// GET /api/admin/wearables/monitoring/alerts
//   Query: { severity?: 'critical'|'high'|'medium', platformId?, from?, to?, page?, limit=100 }
//   Returns: paginated WearableAlertLogDto[]:
//   {
//     id, severity, metricType, platformId, patientTokenPreview (first 8 chars),
//     thresholdValue, readingValue, ts, acknowledged: boolean
//   }
//   Never returns raw readings or patient identity beyond tokenPreview.
//   Used by DPO / admin for monitoring; exportable to CSV.

// GET /api/admin/wearables/monitoring/alerts/export
//   Query: same filters as above
//   Returns: CSV download (Content-Disposition: attachment)
//   AES-256-GCM encrypted if GDPR_EXPORT_BUCKET is set; otherwise plain CSV.
//   audit_log: action='wearable_alert_log_exported', meta={ filters, rowCount }

// GET /api/admin/wearables/monitoring/thresholds/defaults
//   Returns: current global default thresholds per metric type.
//   Source: wearable_global_thresholds table (create in migration if not exists).

// PUT /api/admin/wearables/monitoring/thresholds/defaults/:metricType
//   Body: { criticalLow?, criticalHigh?, highLow?, highHigh? }
//   Role: administrator | super_admin
//   Validates ranges (criticalLow < highLow < highHigh < criticalHigh where all provided).
//   Updates wearable_global_thresholds; alert engine uses these as fallback for patients
//   with no physician-set threshold for that metric.
//   Physician-level thresholds (device_alert_thresholds table, W5) always override.
//   audit_log: action='threshold_updated', meta={ metricType, scope: 'global', previous, next }

// DB migration: wearable_global_thresholds
//   id            String   @id @default(cuid())
//   metric_type   String   @unique
//   critical_low  Float?
//   critical_high Float?
//   high_low      Float?
//   high_high     Float?
//   updated_at    DateTime @updatedAt
//   updated_by    String
```

### C3 — Wearables admin UI in `admin.html`

```
Add a new nav group to the sidebar (below NASTAVENIA / SETTINGS):

  MONITOROVANIE / MONITORING
  [activity icon]  Zariadenia  (Devices)    ← visible to administrator, super_admin

──────────────────────────────────────────────────────────────────────
Devices view — two tabs: "Overview" and "Platforms" (super_admin only)
──────────────────────────────────────────────────────────────────────

[Overview tab] ─ default view ─────────────────────────────────────

Summary cards (same 4-card pattern as bookings stats):
  ┌────────────────┬──────────────┬────────────────────┬─────────────────┐
  │ Connected      │ Sync errors  │ Consent expiring   │ Pending alerts  │
  │ 1,588          │ 3            │ 12 (< 30 days)     │ 5 unread        │
  └────────────────┴──────────────┴────────────────────┴─────────────────┘

Alert log table (below cards):
  Heading: "Alert log — last 500"
  Filters: [All severities ▼]  [All platforms ▼]  [Date range]   [Export CSV]

  Severity  │ Metric              │ Platform    │ Patient    │ Value vs threshold  │ Time
  ● Critical │ glucose_mmol        │ Dexcom G7   │ PT-84A2…   │ 18.2 > 16.7        │ 14:32
  ● High     │ heart_rate_bpm      │ Fitbit      │ PT-2F91…   │ 124 > 120          │ 14:18
  ● Critical │ spo2_pct            │ Withings    │ PT-8C34…   │ 88 < 90            │ 13:55

  Severity badges: ● Critical (red) · ● High (amber) — always with text label for WCAG.
  "Export CSV" calls GET /api/admin/wearables/monitoring/alerts/export with active filters.

Global threshold defaults (below alert log, administrator+):
  Collapsible section "Predvolené limity / Default thresholds"
  Table of metric types with editable threshold fields:
    Metric               Critical low  High low  High high  Critical high  [Edit]
    glucose_mmol         3.0           3.9       10.0       16.7           [Edit]
    heart_rate_bpm        —            —         100        120            [Edit]
    spo2_pct             88            92         —          —             [Edit]
    systolic_bp_mmhg      —            —         140        180            [Edit]

  [Edit] opens inline row editing; [Save] calls PUT endpoint; [Cancel] discards.
  Note shown below table: "Physician-level thresholds always override these defaults."

[Platforms tab] ─ super_admin only ────────────────────────────────

Platform table — Medical / Fitness & Wellness filter tabs:

  Platform         │ Category  │ Credentials  │ Patients  │ Status    │ Actions
  ─────────────────┼───────────┼──────────────┼───────────┼───────────┼──────────────────
  Abbott Libre EU  │ Medical   │ ✓ Set        │ 243       │ [On  ●]  │ [Test connection]
  Dexcom G7        │ Medical   │ ✓ Set        │  89       │ [On  ●]  │ [Test connection]
  Withings         │ Medical   │ ✗ Missing    │   0       │ [Off ○]  │ —
  Omron            │ Medical   │ ✓ Set        │  31       │ [On  ●]  │ [Test connection]
  Medtronic CGM    │ Medical   │ Partnership  │  —        │ [Locked] │ —
  Fitbit           │ Consumer  │ ✓ Set        │ 512       │ [On  ●]  │ [Test connection]
  Garmin           │ Consumer  │ ✓ Set        │ 178       │ [On  ●]  │ [Test connection]
  Google Health    │ Consumer  │ ✓ Set        │ 334       │ [On  ●]  │ [Test connection]
  Samsung          │ Consumer  │ ✓ Set        │ 201       │ [On  ●]  │ [Test connection]
  Huawei           │ Consumer  │ EU blocked   │  —        │ [Locked] │ —
  Apple Health     │ Consumer  │ iOS only     │  —        │ [iOS]    │ —

  Toggle [On ●] / [Off ○]: clicking shows confirm popover
    "Turn off Fitbit? This will prevent new Fitbit connections. Existing connected devices
     continue to sync until patients disconnect." [Confirm] [Cancel]

  [Test connection]: fires POST .../test; shows inline result:
    ✓ OK · 142 ms   or   ✗ Error: 401 Unauthorized

  "Credentials" column: ✓ Set / ✗ Missing / Partnership / EU blocked / iOS only.
  Never shows the actual credential values.
  Tooltip on ✗ Missing: "Set [WITHINGS_CLIENT_ID] and [WITHINGS_CLIENT_SECRET] in .env
                          to enable this platform."
```

---

## Part D — Tests

```typescript
// Unit (booking-admin.service.spec.ts):
// D-1  cancelBooking: valid future booking → status=cancelled, audit entry written, SMS job queued
// D-2  cancelBooking: already cancelled booking → 409 Conflict
// D-3  cancelBooking: clinician with wrong scope (different clinic) → 403 Forbidden
// D-4  cancelBooking: past slot → 422 (cannot cancel past appointment)
// D-5  rescheduleBooking: new slot in same clinic, available → booking updated, notification queued
// D-6  rescheduleBooking: new slot in different clinic → 422
// D-7  rescheduleBooking: clinician role → 403 (administrator+ only)
// D-8  markNoShow: slot in past → status=no_show, audit entry written, no refund queued
// D-9  getStats: returns correct counts from bookings table

// Unit (wearables-admin.service.spec.ts):
// D-10  getPlatforms: returns credentialsConfigured=false when env var missing
// D-11  getPlatforms: credentials present → credentialsConfigured=true; value not in response
// D-12  togglePlatform: super_admin, non-partnership platform → writes override, audit entry
// D-13  togglePlatform: administrator (not super_admin) → 403
// D-14  togglePlatform: partnership_required platform → 422
// D-15  togglePlatform: Huawei → 422 (eu_adequacy_blocked)
// D-16  testConnection: configured platform → returns { ok: boolean, latencyMs }
// D-17  getAlertLog: filters by severity; patientTokenPreview is 8 chars only; no raw readings
// D-18  setGlobalThreshold: valid range → saved; audit entry with scope='global'
// D-19  setGlobalThreshold: criticalLow > highLow → 422 validation error
// D-20  alert engine: patient has physician threshold → global default not used
// D-21  alert engine: patient has no physician threshold → global default applied

// E2E (Playwright):
// A4-1  Administrator cancels future booking → status=cancelled; SMS job in queue; audit entry present.
// A4-2  Clinician views only their own clinic's bookings; other clinic rows absent.
// A4-3  Super admin toggles Garmin off → Garmin absent from patient connect flow.
// A4-4  Test-connection on configured platform → inline { ok: true, latencyMs }.
// A4-5  Platforms table: credentials column never shows env var values.
// A4-6  Global threshold update (administrator) → audit_log entry with scope='global'.
// A4-7  Physician threshold (W5) overrides global default in alert engine evaluation.
// A4-8  axe: zero critical/serious on ?section=bookings and ?section=devices views.
```

---

## Environment variables added by A4

```env
# No new secrets required for A4. The wearable_platform_overrides and
# wearable_global_thresholds tables are DB-backed; no new env vars needed.
# All W2/W3 adapter credentials remain in .env (see Part A.5 above).
```

---

## Done when

### Merge (Part A)
- [ ] `medtronic_cgm` catalog fix committed on branch before merge
- [ ] `feature/wearables-wl9` merged to `main` (fast-forward or split branches — document choice)
- [ ] 301 API tests pass post-merge; `tsc --noEmit` clean
- [ ] `.env.example` updated with all W2/W3 adapter credential placeholders
- [ ] `Project Overview.html` updated: W2, W3, WL9 → "On main"

### Booking management (Part B)
- [ ] GET /api/admin/bookings/ returns paginated list; clinician role scoped to own clinic (D-3 green)
- [ ] Stats endpoint returns today/week/pending counts (D-9 green)
- [ ] Cancel: validates state + rules; audit entry + SMS job (D-1, D-2, D-4 green; A4-1 green)
- [ ] Reschedule: validates same clinic + availability; clinician 403 (D-5, D-6, D-7 green)
- [ ] No-show: past slot only; no refund (D-8 green)
- [ ] Booking list + cancel modal + reschedule modal + no-show in admin.html (A4-2 green)

### Wearables admin (Part C)
- [ ] Platform list: credentialsConfigured boolean only — no credential values in response (D-10, D-11, A4-5 green)
- [ ] Toggle: partnership + Huawei blocked (D-12 through D-15, A4-3 green); audit entry written
- [ ] Test-connection: returns { ok, latencyMs } within 5s (D-16, A4-4 green)
- [ ] Alert log: severity filter, 8-char token preview, CSV export; no raw readings (D-17 green)
- [ ] Global thresholds: validation + save + audit entry (D-18, D-19, A4-6 green)
- [ ] Physician threshold overrides global (D-20, D-21, A4-7 green)
- [ ] Devices view (Overview + Platforms tabs) in admin.html (A4-3, A4-4, A4-5 green)
- [ ] axe: zero critical/serious on all new admin panels (A4-8 green)
