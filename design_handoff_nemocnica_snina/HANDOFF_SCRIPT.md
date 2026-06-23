# Handoff script — paste this at the start of a new chat

---

You are picking up the **Nemocnica Snina** hospital website project. Here is the complete, verified state.

## What this project is
A public-facing hospital website + patient-booking portal + admin CMS + telemedicine module for Nemocnica Snina, Slovakia. The stack is Next.js 15 (App Router) · NestJS 10 + Fastify · Strapi 4 · PostgreSQL · Redis · RabbitMQ · LiveKit WebRTC SFU (EU) · Slovensko.sk eID OIDC · HL7 FHIR R4 · EU hosting.

---

## Repository state (verified build audit)

**Repo:** `/Users/penndaly/Downloads/nemocnica-snina` · **Files:** 219 · **Commits:** 7

| Commit | Description |
|---|---|
| `1e7c8b3` | Phase 0 — monorepo scaffold (pnpm workspaces, Turborepo, tsconfig, packages) |
| `358ac3f` | Phases 2.2–6 — admin CMS, all public pages, booking wizard, onboarding form, patient portal shell |
| `be82514` | Phases 5, 7, 8, 9, 0.2 — onboarding API, integrations, a11y, SEO, tests, styleguide |
| `93248bd` | Booking rule tests (server-side) + DB-level audit log immutability |
| `1525cbb` | Multilingual, Strapi CMS, OIDC portal, double-booking fix, reminder scheduler, cancellation page, mock payment |
| `b4a46fe` | Punchlist — audit hardening, Strapi repoint, booking edge-case tests, FHIR portal, step-up 2FA, GDPR admin UI |
| `1c59502` | Launch checklist L2–L8 — production Docker/nginx, E2E suite (9 specs), CI, staff runbook, DSAR procedure |

### What is built and confirmed working
- **All 11 public pages** (home, departments + detail, clinics, physicians, services, diagnostics, news, disclosures, contact) — CMS-driven, Server Components, 6 locales
- **Booking wizard** — 5-step, all clinic rules enforced server-side (bookingDays, bookingWindow, bookable, status, referral, LSPP fee), atomic slot lock, RC validation, SMS OTP, GDPR consent
- **Booking cancellation page** `/[lang]/objednanie/zrusit/[token]`
- **New-patient onboarding** — form + API + HIS queue publish + RC validation + SMS confirmation
- **Patient portal** — eID/OIDC, FHIR R4 (Conditions, Medications, Observations, Appointments), step-up 2FA for lab PDF
- **Admin CMS** — TOTP MFA, RBAC (editor/clinician/admin), CRUD for all 9 collections, GDPR panel (Art. 15 export + Art. 17 erasure)
- **HIS async queue** — RabbitMQ, DLQ, idempotency, booking.confirmed/cancelled events
- **SMS** — OTP, booking confirmation, 48h reminder, cancel link
- **Payments** — LSPP €1.99 session creation (mock in dev)
- **6-language i18n** — sk/en/cs/pl/hu/uk, locale-prefixed routes, hreflang, machine-translation pipeline (drafts only for clinical content)
- **Security** — TLS 1.3, MFA enforced, DB-level audit log immutability (REVOKE + trigger), bcrypt RC hashes
- **E2E suite** — 9 Playwright specs (booking, onboarding, portal, admin, i18n, a11y, cookie, OTP, HIS queue); axe WCAG 2.1 AA on 10 routes
- **CI** — typecheck, lint, unit, integration, edge-case DB, E2E, smoke-staging
- **Docs** — RETENTION.md, staff runbook, LAUNCH_CHECKLIST, DSAR operator procedure

### What OPS still needs to do (no code required)
| Task | Status |
|---|---|
| L1 — Provision 14 vendor accounts; inject all secrets; kill mocks; `make db-harden` on prod DB | ⬜ Not started |
| L4 — Backup + DR restore drill; measure RTO/RPO | ⬜ Blocked by L1 |
| L5 — Monitoring/alerting; on-call rota | ⬜ Blocked by L1 |
| L6 — External VAPT pen-test; triage critical/high to closure | ⬜ Blocked by L1+L3 |
| L9 — Go/no-go gate → FRO soft-launch → full launch | ⬜ Blocked by L1/L4/L5/L6 |

---

## Design & handoff package

All files in `design_handoff_nemocnica_snina/`:

| File | Purpose |
|---|---|
| `README.md` | Full UI/UX spec, design tokens, component inventory |
| `BUILD_GUIDE.md` | Phases 0–9 Claude Code playbook (all complete) |
| `COMPLETION_BRIEF.md` | Hardening brief A–F (all complete) |
| `PUNCHLIST.md` | 7-task final brief (all complete) |
| `LAUNCH_CHECKLIST.md` | External wiring + go-live L1–L9 |
| `DATA_MODEL.md` | Full Postgres schema + Strapi collections |
| `CONFIG_AND_ENV.md` | 14 env vars, vendor accounts, config validator |
| `E2E_TEST_SPECS.md` | Playwright SPEC 1–9 |
| `PRODUCTION_ARCHITECTURE.md` | Stack, integrations, compliance, phasing |
| `CLAUDE.md` | Repo-level instructions (drop at repo root) |
| `TELEMEDICINE_README.md` | Telemedicine screen specs, UX delta, component extensions |
| `TELEMEDICINE_BUILD_GUIDE.md` | Phases T0–T5 Claude Code playbook |
| `TELEMEDICINE_DATA_MODEL.md` | 3 new tables + clinics/physicians extensions + FHIR R4 mapping |
| `TELEMEDICINE_ARCHITECTURE.md` | LiveKit, WebRTC flow, token rules, GDPR delta, NIS2, minors |
| `TELEMEDICINE_E2E_TESTS.md` | Playwright SPEC TH-1–TH-6 |
| `TELEMEDICINE_CONFIG.md` | 9 new env vars (accounts 15–16 with DPA column), monitoring additions |
| `TELEMEDICINE_COMPLIANCE_REVIEW.md` | Full EU/SK regulatory gap analysis — 3 blockers, 5 required, 4 advisory |
| `SPRINT_BACKLOG.md` | Gap analysis table + Sprints S1–S11, paste-ready prompts |

Prototype files (UI references, not production code):
- `telehealth.html` — public telehealth landing page
- `teleconsult.html` — video consultation room (3 states × 2 views; prototype toggle bar at top)

---

## Roadmap — complete picture

```
BUILD_GUIDE (0–9)          ✅ complete
COMPLETION_BRIEF (A–F)     ✅ complete
PUNCHLIST (7 tasks)        ✅ complete  commit b4a46fe
LAUNCH_CHECKLIST BUILD     ✅ complete  commit 1c59502
LAUNCH_CHECKLIST OPS       ⬜ L1/L4/L5/L6/L9 outstanding

TELEMEDICINE DESIGN        ✅ complete (all 6 docs + 2 prototypes + compliance review)
TELEMEDICINE BUILD         ⬜ not started — begin with Sprint S6

SPRINT BACKLOG S1–S5       ⬜ not started — gaps in base platform
SPRINT BACKLOG S6–S11      ⬜ not started — full telemedicine build
```

---

## Sprint Backlog — gap analysis

The following features are specified in the handoff but absent from (or unconfirmed in) the audit:

| # | Gap | Priority | Sprint |
|---|---|---|---|
| G1 | eDohody staff review queue (admin accept/reject onboarding applications) | 🔴 High | S1 |
| G2 | NCZI eDohoda XML generation on acceptance + patient eID sign notification | 🔴 High | S1 |
| G3 | APS live feed rendering on home + contact (confirmed reachable; rendering unconfirmed) | 🟡 Medium | S2 |
| G4 | NCZI eZdravie prescription routing — all prescriptions (Act 362/2011 legal blocker) | 🔴 High | S3 |
| G5 | Portal: medication refill request → HIS physician inbox | 🟡 Medium | S3 |
| G6 | Payment receipt generation + portal payment history | 🟡 Medium | S3 |
| G7 | Portal: cancel-appointment link per FHIR Appointment in portal | 🟡 Medium | S3 |
| G8 | RETENTION.md: HIS 20-year FHIR Encounter clarification (Act 576/2004 §24) | 🔴 High | S4 |
| G9 | NIS2 incident reporting procedure + NKIBK contact | 🔴 High | S4 |
| G10 | MDR 2017/745 scope exclusion document | 🟡 Medium | S4 |
| G11 | UI/UX verification pass (home page sections, dept detail, physician filters, news deep-link, disclosures PDF) | 🟡 Medium | S5 |
| G12–G21 | Full telemedicine module | 🔴 High | S6–S11 |

---

## Sprint S1 — eDohody Completion

**Driver prompt:**
```
Read design_handoff_nemocnica_snina/BUILD_GUIDE.md §Phase 5 and PRODUCTION_ARCHITECTURE.md
§module 3 in full. The current codebase (commit 1c59502) has OnboardingModule creating
OnboardingApplication records but is missing three things. Build all three in one commit:

1. STAFF REVIEW QUEUE in /admin (clinician/admin role only):
   Add "Onboarding applications" to the admin sidebar under a new "Patients" section.
   List view: patient RC hash (masked), chosen physician, insurer code, submitted date,
   status badge (pending/accepted/rejected). Detail view: Accept + Reject (with required
   reason textarea). Both actions write to audit_log. RBAC: editor role blocked (403).

2. NCZI eDOHODA XML GENERATION on acceptance:
   OnboardingService.accept(id, actorId):
   (a) Updates OnboardingApplication.status = ACCEPTED.
   (b) Generates NCZI eDohoda XML: patientRc, insurerCode, doctorCode (from physician
       record), validFrom (today), validTo (+1 year), hospitalIco (from Hospital singleton).
   (c) Stores XML as ncziXmlPayload: String? on the application record (add to Prisma schema).
   (d) Publishes onboarding.accepted to RabbitMQ with the XML payload.
   (e) Writes audit_log entry.

3. PATIENT NOTIFICATION:
   Acceptance: SMS in SK + EN — "Vaša žiadosť o registráciu u MUDr. [name] bola schválená.
   Podpíšte digitálnu dohodu cez Slovensko.sk eID: [link]". Link is a stub page
   /[lang]/registracia/podpis?token=[token] showing placeholder instructions.
   Rejection: SMS with the rejection reason.

4. TESTS: accept flow (status, XML fields, queue event, audit); reject flow (status, reason,
   no XML, audit); RBAC (editor 403); XML field validation.

No patient RC in plaintext anywhere — use existing patientRcHash pattern.
```
**Done when:** admin clinician can accept/reject; acceptance generates valid NCZI XML + publishes to queue + SMS patient; rejection notifies; RBAC enforced; tests green.

---

## Sprint S2 — APS Live Feed

**Driver prompt:**
```
Read design_handoff_nemocnica_snina/PRODUCTION_ARCHITECTURE.md §Integrations (e-VÚC)
and BUILD_GUIDE.md §Phase 7.2. Implement or verify-and-harden the APS live feed:

1. Create ApsService (in apps/api or a Next.js route handler at /api/aps):
   - Fetches live APS schedule from APS_FEED_URL + APS_FEED_API_KEY.
   - Caches in Redis with TTL = APS_CACHE_TTL_SECONDS (default 600).
   - On Redis hit: return cached data. On miss: fetch, cache, return.
   - On PSK API failure: return CMS pages.aps fallback text with isFallback: true.
   - Parses response into ApsEntry[] (date, provider, phone, location).

2. Update home page [lang]/ to call /api/aps and render the live APS sidebar card. If
   isFallback=true, show a "Live schedule temporarily unavailable" note.

3. Update contact page [lang]/kontakt APS block with the same data source.

4. Update smoke test §APS to verify /api/aps returns 200 with parseable ApsEntry[], not
   just URL reachability.

5. Add APS staleness alert to L5 monitoring spec (trigger if cache age > 2× TTL).
```
**Done when:** home + contact show live APS; Redis caching confirmed; CMS fallback renders on forced failure; smoke test checks parsed data; monitoring alert defined.

---

## Sprint S3 — Portal & Payment Completion

**Driver prompt:**
```
Read design_handoff_nemocnica_snina/README.md §Patient portal, COMPLETION_BRIEF.md §D1,
and TELEMEDICINE_COMPLIANCE_REVIEW.md §B2. Fix four areas:

PART A — NCZI eZdravie prescription routing (Act 362/2011 — legal blocker):
In the HIS sync agent, when a MedicationRequest is created (booking or teleconsult path):
after writing the FHIR resource to HIS, submit to NCZI eZdravie (NCZI_EDOHODY_ENDPOINT /
NCZI_API_KEY). Store the returned prescription code as MedicationRequest.identifier
(system: 'urn:oid:nczi.ezdravia'). Send code to patient via SMS. If eZdravie fails:
dead-letter separately; retry + DLQ; never block booking confirmation. Audit all attempts.

PART B — Portal refill request:
Add "Request refill" button on MedicationRequest cards with refills > 0.
POST /api/portal/refill { medicationRequestId } → publishes portal.refill.requested to
RabbitMQ → HIS sync agent routes to physician HIS inbox. Rate-limit: 1 per medication
per 7 days (Redis). Response: "Refill request sent." (SK + EN, aria-live). Audited.

PART C — Appointments tab cancel link:
On each FHIR Appointment card in the portal: show "Cancel appointment" link calling
GET /api/portal/appointments/:fhirId/cancel-token → returns cancelToken if the
appointment matches the authenticated patient → deep-links to /[lang]/objednanie/zrusit/[token].

PART D — Payment receipts:
On successful payment webhook: generate a PDF receipt (name, item, amount, date, ICO/DIC,
transaction ref) via the PDF service. Store path in payment_receipts table (transactionRef,
bookingId, pdfPath, createdAt). Add "Download receipt" to booking confirmation step 5 and
to a "Payments" tab in the patient portal. Receipt download requires patient session only
(not step-up 2FA). Audit every download.
```
**Done when:** prescriptions route via eZdravie with DLQ fallback; refill request queues to HIS; portal appointments show cancel links; receipts generate on webhook + downloadable from portal; all actions audited; eZdravie failure never blocks booking confirmation.

---

## Sprint S4 — Compliance Documentation

**Driver prompt:**
```
Read design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md §B3, §R1, §R6
and the existing RETENTION.md. Produce three documents:

1. Update RETENTION.md — add Medical Records section:
   FHIR Encounter in HIS = 20 years (Act 576/2004 §24) — this is the HIS vendor's
   obligation; our DB holds operational metadata only. Add the telehealth-specific rows
   from TELEMEDICINE_DATA_MODEL.md §Retention. Add: never purge telehealth_summaries
   where his_synced=false. Add to LAUNCH_CHECKLIST.md §L7: HIS vendor confirms
   20-year FHIR Encounter retention in writing.

2. Create docs/NIS2_INCIDENT_PROCEDURE.md:
   Covers: scope (essential entity, NIS2 + Act 69/2018), severity classification
   (Critical/High/Medium/Low with examples including telemedicine triggers), reporting
   timeline (24h initial alert → 72h detailed report to NKIBK), internal escalation
   (DPO + IT lead jointly), patient notification threshold (GDPR Art. 34 when high risk),
   NKIBK contact placeholder (ops to fill), post-incident process.

3. Create docs/MDR_SCOPE_EXCLUSION.md:
   Template for Quality/Regulatory to sign. States: this software is a human-to-human
   communication tool; no autonomous clinical decisions; excluded from MDR per MDCG 2019-11.
   Scope review triggers listed. Signature block (Quality/Regulatory lead + date).

Add all three to LAUNCH_CHECKLIST.md §L9 gate:
  [ ] RETENTION.md updated; HIS vendor 20-year retention confirmed in writing
  [ ] NIS2_INCIDENT_PROCEDURE.md: NKIBK contact filled, escalation contacts named
  [ ] MDR_SCOPE_EXCLUSION.md: signed by Quality/Regulatory lead
```
**Done when:** RETENTION.md updated; NIS2 procedure covers classification/timelines/telemedicine triggers; MDR template is signable; all three in L9 gate.

---

## Sprint S5 — Hardening & Verification Pass

**Driver prompt:**
```
Read design_handoff_nemocnica_snina/README.md §Screens and compare the staging site
against the prototype HTML files. Verify and fix each item; report findings in
docs/S5_VERIFICATION_REPORT.md:

1. HOME PAGE — verify all 5 sections are CMS-driven:
   (a) Emergency card: correct phone numbers from Hospital singleton; 112 link.
   (b) Quick access: 3 cards → /oddelenia, /ambulancie, /lekari; hover arrow.
   (c) Accepting-new-patients: 3 physician cards accepting=true; green badge; bio; link.
   (d) Featured departments: 3 cards featured=true; 16:9 placeholder; beds chip.
   (e) News + APS: news badges (good=green, info=blue, alert=amber+left border); APS card.

2. DEPARTMENT DETAIL — verify:
   (a) Facilities checklist: 2-col green-check list from department.facilities[].
   (b) Related physicians: avatar mini-cards.
   (c) Sticky contact card (right sidebar): phone/email/lead/deputy/visiting hours/buttons.
       Sticky desktop, static mobile (<940px).

3. PHYSICIAN DIRECTORY — verify:
   (a) Language tags (.lang-tag chips) from physician.langs[].
   (b) Language filter in addition to "accepting new patients" checkbox.
   (c) Empty state message.

4. NEWS — verify deep-link: /aktuality#[id] scrolls to and highlights target article.

5. DISCLOSURES — verify PDF download per row works; admin has "Attach PDF" file field.

6. CLINIC CARDS — verify 4 status badges + legend; booking rule callout; disabled button
   when bookable=false.

For each item: ✓ confirmed / ✗ found missing (and fix it). Commit with report.
```
**Done when:** all 7 items confirmed or fixed; no E2E regression; `docs/S5_VERIFICATION_REPORT.md` committed.

---

## Telemedicine Sprints S6–S11

**Prerequisite:** Read these files before starting any telemedicine sprint:
```
design_handoff_nemocnica_snina/TELEMEDICINE_README.md
design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md
design_handoff_nemocnica_snina/TELEMEDICINE_DATA_MODEL.md
design_handoff_nemocnica_snina/TELEMEDICINE_ARCHITECTURE.md
design_handoff_nemocnica_snina/TELEMEDICINE_CONFIG.md
design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md
design_handoff_nemocnica_snina/TELEMEDICINE_E2E_TESTS.md
telehealth.html   ← public landing page UI reference
teleconsult.html  ← video room UI reference (3 states × 2 views)
```

### Sprint S6 — Telemedicine Foundations
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T0.1` + `§T0.2`
**Key deliverables:**
- PostgreSQL migrations: `telehealth_sessions`, `telehealth_intake`, `telehealth_summaries`; status-transition constraint (allowed/forbidden at DB level)
- Strapi: `clinics.telehealth`, `clinics.telehealthWindow`, `clinics.telehealthRule`; `physicians.telehealth`; `pages.telehealth` singleton
- Seed: `telehealth=true` on clinics `[interne, fro, angiology]` and their physicians
- Config validator: `TELEHEALTH_PROVIDER ≠ mock` in prod; `LIVEKIT_URL` starts `wss://`; `LIVEKIT_TURN_REGION` non-empty EU in prod; recording gate
- NestJS `TelehealthModule`: `VideoProviderService` interface + LiveKit adapter + mock provider; `TelehealthSessionService` (createSession, joinSession, admitPatient, endSession, handleNoShow); all REST endpoints; audit_log on every action
- Unit tests: token issuance, status transitions, no-show job, idempotent room creation

**Done when:** migrations apply; Strapi fields present; join endpoint returns mock token in CI; illegal transitions rejected at DB + service layer; audit entries written; unit tests green.

---

### Sprint S7 — Patient Booking + Telehealth Landing Page
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T1.1` + `§T1.2`
**Key deliverables:**
- `/[lang]/objednanie?mode=telehealth`: only `telehealth=true` clinics in Step 1; `telehealthWindow` for date filtering; "Video" slot labels; device-check callout (`getUserMedia`); telehealth GDPR consent (mandatory, stored as `booking_consents.consent_type='telehealth_medical_record'`); Step 5 confirmation with "Join consultation" button (active 10 min before start)
- Server enforces: `mode=telehealth` rejected for `telehealth=false` clinics; consent required
- Minor access block: eID-verified under-16 → block; 16–17 → guardian co-presence checkbox; both logged to audit_log
- `/[lang]/telehealth` CMS-driven page matching `telehealth.html`; hero from Strapi `pages.telehealth` singleton; eligible clinics from Strapi filtered `telehealth=true`; ISR
- Nav + footer links; telehealth privacy notice at `/[lang]/telehealth/sukromie` (or kontakt.html `#telehealth-gdpr`)
- hreflang updated for new route

**Done when:** telehealth booking completes end-to-end; consent stored; under-16 blocked at API; non-telehealth path unchanged; `/sk/telehealth` matches prototype; nav link present; hreflang updated.

---

### Sprint S8 — Video Consultation Room (Patient Side)
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T1.3`
**Key deliverables:**
- `/[lang]/telehealth/konzultacia/[sessionId]` — protected (eID/OIDC required)
- Pre-call device check: `getUserMedia`, error card with clinic phone on denial, `sessionStorage th_device_ok`
- `GET /telehealth/sessions/:id/join` → LiveKit token; verify session belongs to patient; terminal state on cancelled/ended/no_show
- LiveKit `@livekit/client` SDK: connect → waiting room → `room.admitted` event → active call → end → post-call
- Controls: mic toggle (`aria-pressed`), camera toggle, screen share, end call (Escape key → confirmation dialog)
- Elapsed timer from `sessionStorage th_start`; state persisted in `sessionStorage th_room_state`
- Post-call overlay: fetch summary from `GET /sessions/:id/summary`; patient action buttons
- `aria-live="polite"` region for status changes; focus management on state transitions; keyboard-operable
- axe WCAG 2.1 AA: zero violations on waiting / active / postcall states

**Done when:** patient can join, wait, go live on admit, end call, see post-call summary; device check works; keyboard-operable; axe zero violations on all 3 room states.

---

### Sprint S9 — Portal Teleconsultations + Physician Console
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T1.4` + `§T2.1`
**Key deliverables:**
- Portal: "Teleconsultations" nav item; Upcoming tab (join button active 10 min before, cancel link); Past tab ("View summary" inline expand, "Download summary PDF" step-up 2FA gated + audited); empty states with booking CTA
- Physician admin schedule: `/admin` "Telehealth" sub-section; today + 7-day session list; "Join call" + "View intake" per row
- `/konzultacia/[id]?role=physician`: patient in main tile; self PiP; side panel (intake data); "Admit patient" button; MFA re-verify on join endpoint; post-call: clinical note editable, "Save to HIS" button triggers `telehealth.session.ended` event

**Done when:** portal shows upcoming/past; join activates at correct time; PDF step-up gated; physician can admit patient; doctor room side panel renders intake; MFA re-verified on physician join.

---

### Sprint S10 — HIS Integration + Full Compliance
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T3.1` + `§T3.2` (full updated version with compliance review items)
**Key deliverables:**
- HIS sync agent consumes `telehealth.session.ended`: writes FHIR `Encounter` (status=finished, class=VR), `MedicationRequest` + NCZI eZdravie code (extends S3 work to the telehealth path), proposed `Appointment`; sets `his_synced=true`; idempotent; DLQ + retry
- Purge guard: `telehealth_summaries` rows with `his_synced=false` are never eligible for purge (DB partial index or application-level guard)
- Config validator: `TELEHEALTH_RECORDING_ENABLED=false` in prod; recording + DPO gate; `LIVEKIT_TURN_REGION` EU assertion
- Consent gate at join: `403` if `telehealth_medical_record` consent absent
- Minor block at join API: `403` if patient eID age < 16
- Telehealth privacy notice linked from booking Step 4 consent checkbox
- L9 gate additions: DPIA, HIS 20-year retention, DPAs, MDR exclusion, pen-test items added to `LAUNCH_CHECKLIST.md §L9`

**Done when:** post-call FHIR Encounter in HIS sandbox; prescription code via eZdravie + SMS; idempotent replay confirmed; recording blocked; minor blocked; privacy notice linked; TURN validator in config; all compliance L9 gate items added.

---

### Sprint S11 — Admin Config + E2E Tests + Launch Gate
**Prompt from:** `TELEMEDICINE_BUILD_GUIDE.md §T4.1` + `§T5.1`
**Key deliverables:**
- Admin "Telehealth" section: Clinics subview (telehealth toggle, video window, bilingual booking rule); Physicians subview (telehealth toggle); Sessions overview (today + 7 days, anonymised, manual cancel with reason + SMS + audit)
- Editor role blocked from Sessions view
- SPEC TH-1 through TH-6 (`TELEMEDICINE_E2E_TESTS.md`) all green in CI; axe on `/telehealth` and room route (all 3 states)
- TH-Pilot soft-launch plan: telehealth enabled for FRO only; 2-week burn-in; expand to all `telehealth=true` clinics after clean burn-in
- Monitoring additions: session join failure rate, admission latency, post-call HIS sync DLQ, PDF generation failures, LiveKit SFU uptime, recording-flag synthetic check

**Done when:** clinic/physician toggles propagate to live site within `CONTENT_REVALIDATE_SECONDS`; TH-1–TH-6 green in CI; L9 gate updated with telemedicine items; TH-Pilot plan documented; monitoring alerts added.

---

## Sprint dependency map

```
S1 (eDohody)    ─┐
S2 (APS)        ─┤──> S5 (verify) ──> L9
S3 (portal)     ─┘
S4 (compliance) ──────────────────────> L9 gate docs

S1 ──> S6 (TH foundations) ──> S7 ──> S8 ──> S9 ──> S10 ──> S11 ──> TH-Pilot
S3 (eZdravie) ──────────────────────────────────────> S10 (extends eZdravie to video path)
S4 ─────────────────────────────────────────────────> S10 (compliance gate items)
```

**Parallel opportunities:** S1 / S2 / S3 / S4 have no dependencies on each other — run in separate Claude Code sessions simultaneously. S5 gates on S1–S3. S6–S11 are sequential.

---

## Key design decisions (all locked)

### Base platform
- Soft-launch pilot: **FRO** (Fyziatricko-rehabilitačné oddelenie) first, then full rollout
- Machine translations (cs/pl/hu/uk): always **drafts / needs-review** — never auto-published
- Booking weekdays: Mo=1, Tu=2, We=3, Th=4, Fr=5, Sa=6, Su=0
- App DB role: INSERT+SELECT on `audit_log` only; migrations via `DATABASE_MIGRATION_URL`
- `OIDC_MOCK_ENABLED` and `HIS_MOCK_ENABLED` must be `false` in production

### Telemedicine
- Video provider: **LiveKit** (self-hosted EU or livekit.io EU region); provider-agnostic adapter
- **No recording by default** — `TELEHEALTH_RECORDING_ENABLED=false`; requires `TELEHEALTH_RECORDING_DPO_APPROVED=true` to override; config validator enforces
- **No patient identity in `telehealth_sessions`** — only opaque `patient_token`
- Post-call clinical data: HIS via `telehealth.session.ended` RabbitMQ event → FHIR Encounter; `telehealth_summaries` is portal cache only
- **Physician join requires MFA re-verification** at the join endpoint
- `TELEHEALTH_PROVIDER=mock` in dev/CI; config validator rejects `mock` in production
- **TURN servers must be EU-resident** — `LIVEKIT_TURN_REGION=eu` validated in production
- **NCZI eZdravie** is the legally valid prescription (Act 362/2011) — FHIR MedicationRequest in HIS is the clinical record copy only

### Compliance gates (all must be green before L9)
- DPIA completed and signed by DPO (GDPR Art. 35)
- HIS vendor confirms 20-year FHIR Encounter retention in writing (Act 576/2004 §24)
- DPAs signed for LiveKit (cloud) and PDF service (GDPR Art. 28)
- MDR scope exclusion document signed by Quality/Regulatory (MDR 2017/745)
- NIS2 incident procedure: NKIBK contact filled, escalation contacts named (NIS2 + Act 69/2018)
- External VAPT pen-test: telemedicine scope included; all critical/high findings closed (L6)

---

*Paste this message to start a new session. To resume the base platform: execute the next unblocked sprint (S1–S5). To start telemedicine: execute Sprint S6 using the driver prompt prefix in SPRINT_BACKLOG.md.*
