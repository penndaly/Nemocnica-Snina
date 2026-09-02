# Sprint Backlog — Nemocnica Snina (Post-Audit)

**Picks up from:** commit `1c59502` — all phases of `BUILD_GUIDE.md` (0–9), `COMPLETION_BRIEF.md` (A–F), `PUNCHLIST.md` (7 tasks), and `LAUNCH_CHECKLIST.md` BUILD tasks (L2–L8) are confirmed complete per the full build audit. The audit verified 219 files across 7 commits. OPS tasks L1/L4/L5/L6/L9 remain outstanding (no code; ops only).

**What this document covers:**
1. Gap analysis — handoff-specified features absent from the audit
2. **Sprints S1–S5** — non-telemedicine gaps, paste-ready for Claude Code
3. **Sprints S6–S11** — full telemedicine module (see `TELEMEDICINE_BUILD_GUIDE.md` for expanded prompt detail; this doc provides sequenced sprint wrappers)

**Sequencing rule:** S1–S4 can run in parallel with each other. S6+ (telemedicine) depends on S1 being complete (shared onboarding infrastructure) and should follow S4 (compliance docs gate the DPIA). S5 is a hardening pass that can slot in any time after S3.

---

## Gap Analysis

| # | Feature | Handoff reference | Audit verdict | Sprint |
|---|---|---|---|---|
| G1 | eDohody RC encryption gap — `onboarding.service.ts` passes `[REDACTED]` as patientRc to `generateEDohoda()`; RC must be encrypted (not just hashed) at apply-time so it is recoverable at acceptance | BUILD_GUIDE Phase 5 | ⚠️ Partial — `nczi-xml.service.ts` + `review()` exist; XML payload incomplete | S1 |
| G2 | eDohody patient SMS notification — `review()` accept/reject has no SMS dispatch; patient is not notified | BUILD_GUIDE Phase 5 | ⚠️ Partial — admin UI at `/admin/onboarding/` confirmed; SMS step missing | S1 |
| G3 | APS rendering on home + contact — `aps.service.ts` confirmed in API; confirm web pages call it and render live schedule | BUILD_GUIDE Phase 7.2 | ⚠️ Partial — service exists; web rendering unconfirmed | S2 |
| G4 | APS live feed (home + contact) with Redis cache + CMS fallback | BUILD_GUIDE Phase 7.2, PRODUCTION_ARCHITECTURE.md | ⚠️ Smoke test verifies e-VÚC PSK URL reachability; pages use `getPageContent().aps` (CMS text); live feed rendering + Redis caching not confirmed | S2 |
| G5 | NCZI eZdravie prescription routing (Act 362/2011) | TELEMEDICINE_COMPLIANCE_REVIEW.md B2 | ❌ Prescriptions exist only as FHIR MedicationRequest in HIS; eZdravie submission step missing for all prescription flows | S3 |
| G6 | Portal: medication refill request | BUILD_GUIDE Phase 6 | ❌ Portal shows MedicationRequest tab but no refill action described | S3 |
| G7 | Payment receipt generation (PCI-compliant, localized) | COMPLETION_BRIEF D1 | ⚠️ LSPP payment session created (€1.99 mock); receipt issuance + webhook idempotency not confirmed | S3 |
| G8 | Portal: view + cancel upcoming appointments from within portal | README.md portal spec, objednanie/zrusit | ⚠️ FHIR Appointments tab exists; cancel page exists at /objednanie/zrusit/[token]; whether portal links to it per-appointment unclear | S3 |
| G9 | RETENTION.md: HIS 20-year FHIR Encounter retention clarification (Act 576/2004 §24) | TELEMEDICINE_COMPLIANCE_REVIEW.md B3 | ⚠️ RETENTION.md covers bookings (5yr) + audit log (5yr) but does not address FHIR Encounter medical record obligation | S4 |
| G10 | NIS2 (EU) 2022/2555 incident reporting procedure + NKIBK contact | TELEMEDICINE_COMPLIANCE_REVIEW.md R1 | ❌ Absent from all docs | S4 |
| G11 | MDR (EU) 2017/745 scope exclusion document | TELEMEDICINE_COMPLIANCE_REVIEW.md R6 | ❌ Absent | S4 |
| G12 | Telehealth landing page `/[lang]/telehealth` | TELEMEDICINE_README.md | ❌ Entire telemedicine module absent from codebase | S6–S11 |
| G13 | Video consultation room | TELEMEDICINE_README.md | ❌ | S8 |
| G14 | NestJS TelehealthModule + LiveKit adapter | TELEMEDICINE_BUILD_GUIDE.md T0.2 | ❌ | S6 |
| G15 | Booking wizard `?mode=telehealth` + telehealth consent + minor age block | TELEMEDICINE_BUILD_GUIDE.md T1.1 | ❌ | S7 |
| G16 | Portal teleconsultations section (upcoming + past tabs) | TELEMEDICINE_BUILD_GUIDE.md T1.4 | ❌ | S9 |
| G17 | Physician schedule console + doctor-side room | TELEMEDICINE_BUILD_GUIDE.md T2.1 | ❌ | S9 |
| G18 | HIS FHIR Encounter for teleconsults via queue | TELEMEDICINE_BUILD_GUIDE.md T3.1 | ❌ | S10 |
| G19 | Telehealth compliance: recording flag, TURN server, consent gate, DPIA gate in L9 | TELEMEDICINE_BUILD_GUIDE.md T3.2 | ❌ | S10 |
| G20 | Admin telehealth config section | TELEMEDICINE_BUILD_GUIDE.md T4.1 | ❌ | S11 |
| G21 | E2E SPEC TH-1 through TH-6 + telemedicine L9 gate | TELEMEDICINE_E2E_TESTS.md | ❌ | S11 |

---

## Sprint S1 — eDohody Completion

**What's missing:** The OnboardingModule creates `OnboardingApplication` records and publishes to the HIS queue, but the full eDohody pipeline is incomplete: there is no staff review queue in the admin, no NCZI eDohoda XML generation, and no patient notification to sign via eID.

**Prompt:**
```
Read design_handoff_nemocnica_snina/BUILD_GUIDE.md §Phase 5 and PRODUCTION_ARCHITECTURE.md
§module 3 in full. The current codebase (commit 1c59502) has OnboardingModule creating
OnboardingApplication records but is missing:

1. STAFF REVIEW QUEUE in /admin (clinician/admin role only):
   - Add "Onboarding applications" to the admin sidebar under a new "Patients" section.
   - List view: columns = patient RC hash (masked), chosen physician, insurer code, submitted date,
     status badge (pending/accepted/rejected). Sort by submitted date desc.
   - Detail view: show full application fields; two actions: "Accept" and "Reject" (with required
     reason textarea). Both write to audit_log. Status badge updates in real time.
   - Accepted applications become visible to the assigned physician in the clinician role view.

2. NCZI eDOHODA XML GENERATION on acceptance:
   - On Accept action: call OnboardingService.accept(id, actorId). This method:
     (a) Updates OnboardingApplication.status = ACCEPTED.
     (b) Generates the NCZI eDohoda XML per PRODUCTION_ARCHITECTURE.md schema:
         patientRc (from application), insurerCode, doctorCode (from physician record),
         validFrom (today), validTo (+1 year), hospitalIco (from Hospital singleton).
     (c) Stores the XML as a string on the application record (add ncziXmlPayload: String?
         to the Prisma model).
     (d) Publishes onboarding.accepted to the RabbitMQ queue (already exists) with the XML
         payload so the HIS sync agent can submit it to NCZI.
     (e) Writes an audit_log entry.

3. PATIENT NOTIFICATION after acceptance:
   - Send an SMS to the patient's phone (from the application) using the existing SmsService:
     "Vaša žiadosť o registráciu u MUDr. [name] bola schválená. Podpíšte digitálnu dohodu
     cez Slovensko.sk eID: [link]". SK and EN templates. The link is a deep-link to
     /[lang]/registracia/podpis?token=[booking-style token] (stub page for now — the real
     eID signing flow is out of scope for this sprint; show a placeholder card with instructions).
   - On Reject: SMS to patient with the rejection reason.

4. UNIT + INTEGRATION TESTS:
   - Test accept flow: application status → ACCEPTED; XML contains correct fields; queue event
     published with XML; audit_log entry written.
   - Test reject flow: status → REJECTED; reason stored; audit_log entry; no XML generated.
   - Test RBAC: editor role cannot access accept/reject endpoints (403).
   - Test XML structure: validate against the required NCZI eDohoda schema fields.

All changes audited. No patient RC stored in plaintext anywhere — use existing patientRcHash pattern.
```
**Reference:** `BUILD_GUIDE.md` §Phase 5, `PRODUCTION_ARCHITECTURE.md` §module 3, `DATA_MODEL.md` onboarding_application
**Done when:** admin clinician can see pending applications, accept/reject them; acceptance generates valid NCZI XML, publishes to queue, SMS patient; rejection notifies patient; RBAC enforced; all changes audited; unit + integration tests green.

---

## Sprint S2 — APS Live Feed

**What's missing:** The smoke test verifies e-VÚC PSK URL reachability, but the home page and contact page currently read `pages.aps` from the CMS singleton (static text). The live feed integration with Redis caching and graceful CMS fallback is not confirmed in the build.

**Prompt:**
```
Read design_handoff_nemocnica_snina/PRODUCTION_ARCHITECTURE.md §Integrations (e-VÚC) and
BUILD_GUIDE.md §Phase 7.2. Implement or verify-and-harden the APS live feed:

1. Create ApsService in apps/api (or a Next.js route handler in apps/web/src/app/api/aps/):
   - GET /api/aps — fetches the live e-VÚC Prešov region APS schedule from the PSK API
     (APS_FEED_URL + APS_FEED_API_KEY env vars).
   - Caches the response in Redis with TTL = APS_CACHE_TTL_SECONDS (default 600).
   - On Redis hit: return cached data. On cache miss: fetch live feed, cache it, return it.
   - On PSK API error or timeout: return the CMS fallback text from pages.aps (Strapi singleton),
     with a boolean `isFallback: true` in the response so the UI can show a staleness indicator.
   - Parses the PSK API response into a structured ApsEntry[] (date, provider, phone, location)
     matching the format shown on the prototype pages (index.html, kontakt.html).

2. Update the home page [lang]/ Server Component to call /api/aps and render the live APS
   sidebar card (right column of the News + APS section). If isFallback=true, show a subtle
   "Live schedule temporarily unavailable" note below the fallback text.

3. Update the contact page [lang]/kontakt to render the live APS block (red left-border callout,
   as in the prototype) with the same /api/aps data source.

4. Verify the smoke test (scripts/smoke-test.ts §APS) checks not just URL reachability but also
   that /api/aps returns a 200 with parseable data (or confirms the CMS fallback is working).

5. Add APS feed staleness to the L5 monitoring spec: alert if the APS cached value is older
   than 2 × APS_CACHE_TTL_SECONDS (feed hasn't refreshed despite TTL expiry).
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` §Integrations, `README.md` §Home, §Contact, `CONFIG_AND_ENV.md` APS vars
**Done when:** home + contact pages show live APS data from e-VÚC; Redis caching confirmed (second request served from cache, TTL respected); CMS fallback renders when feed is forced to fail; smoke test checks parsed data not just reachability; monitoring alert defined.

---

## Sprint S3 — Portal & Payment Completion

**What's missing:** The portal shows FHIR data but the refill-request action is absent; payment receipts are not confirmed; the portal Appointments tab may not link to the cancel flow; NCZI eZdravie prescription routing is absent from all prescription paths.

**Prompt:**
```
Read design_handoff_nemocnica_snina/README.md §Patient portal, COMPLETION_BRIEF.md §D1,
and TELEMEDICINE_COMPLIANCE_REVIEW.md §B2. Fix three areas:

PART A — NCZI eZdravie prescription routing (Act 362/2011 — legal blocker):
The current portal and post-booking flows store FHIR MedicationRequest in HIS, but Slovak law
requires prescriptions to be submitted to NCZI eZdravie. Implement:
- In the HIS sync agent, when consuming a booking.confirmed or telehealth.session.ended event
  that results in a MedicationRequest: after writing the FHIR resource to HIS, submit the
  prescription to the NCZI eZdravie API (NCZI_EDOHODY_ENDPOINT / NCZI_API_KEY, same creds).
- eZdravie returns a prescription code. Store it as the MedicationRequest.identifier in HIS
  (system: 'urn:oid:nczi.ezdravia'). Send the code to the patient via SMS.
- If eZdravie is unavailable: dead-letter the prescription submission separately from the main
  booking event; retry + DLQ; never block the booking confirmation.
- Add prescription submission attempts to audit_log.
- Confirm with hospital IT (document in a TODO comment) that the NCZI_EDOHODY_ENDPOINT accepts
  prescription submissions in addition to eDohoda documents.

PART B — Portal refill request:
In the portal Medications tab (apps/web/src/app/[lang]/portal/):
- Add a "Request refill" button on each MedicationRequest card that has refills > 0.
- On click: POST /api/portal/refill { medicationRequestId } → API publishes a
  portal.refill.requested event to RabbitMQ with the patient token and medication reference.
  The HIS sync agent routes this to the physician's HIS inbox via HL7/FHIR Message.
- Response: "Refill request sent. Your physician will be notified." (SK + EN, aria-live).
- Rate-limit: one refill request per medication per 7 days (checked in Redis).
- Audited.

PART C — Appointments in portal + cancel link:
In the portal Appointments tab:
- Render each FHIR Appointment with: date/time chip, physician name, clinic name, status badge.
- For CONFIRMED/PENDING appointments: show a "Cancel appointment" link that deep-links to
  /[lang]/objednanie/zrusit/[cancelToken]. The cancelToken must be fetched from our DB via
  GET /api/portal/appointments/:fhirId/cancel-token (returns the token if the appointment
  matches the authenticated patient session; 404 if not found).

PART D — Payment receipt:
In the payments flow (PaymentsModule, apps/web/src/app/mock-payment/):
- On successful payment webhook (already idempotent): generate a PDF receipt using the
  existing PDF service infrastructure. Receipt contains: patient name (from booking), service
  item (LSPP fee + description), amount, date, hospital ICO/DIC, transaction reference.
  Store receipt path in a new payment_receipts table (transactionRef, bookingId, pdfPath,
  createdAt).
- Add "Download receipt" to the booking confirmation step and to a new "Payments" tab in
  the patient portal. Receipt download is authenticated (patient session, not step-up 2FA).
- Audit every receipt download.
```
**Reference:** `COMPLETION_BRIEF.md §D1`, `README.md §Patient portal`, `TELEMEDICINE_COMPLIANCE_REVIEW.md §B2`, `PRODUCTION_ARCHITECTURE.md §payments`
**Done when:** prescriptions route through eZdravie (with DLQ fallback); refill request queues to HIS; portal appointments show cancel links; payment receipts generate on webhook success and are downloadable from the portal; all actions audited; eZdravie failure doesn't block booking confirmation.

---

## Sprint S4 — Compliance Documentation

**What's missing:** Three compliance documents required before go-live are entirely absent: the HIS 20-year medical record retention clarification (legal), NIS2 incident reporting procedure (legal), and MDR scope exclusion statement (legal). These are documentation tasks that unblock L9 gate items.

**Prompt:**
```
Read design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md §B3, §R1, §R6 and
the existing docs/STAFF_EDITING_RUNBOOK.md and RETENTION.md. Produce three documents:

1. Update RETENTION.md — add a Medical Records section:
   "FHIR Encounter (HIS): retained 20 years per Act 576/2004 §24. This is the HIS vendor's
   obligation; our web-tier database holds only operational metadata (bookings, onboarding
   applications, audit log) which are NOT the legal medical record. Confirm the HIS vendor's
   20-year retention SLA in writing before go-live (see LAUNCH_CHECKLIST.md §L7)."
   Also add the telemedicine-specific rows from TELEMEDICINE_DATA_MODEL.md §Retention.

2. Create docs/NIS2_INCIDENT_PROCEDURE.md:
   - Title: Cybersecurity Incident Reporting Procedure — Nemocnica Snina
   - Scope: covers the hospital website, patient portal, booking system, admin CMS, and (when
     built) telemedicine module. Hospital is an essential entity under NIS2 (EU) 2022/2555,
     transposed via Act 69/2018 Z.z. as amended.
   - Severity classification: Critical (patient data breach, unauthorized session access,
     HIS sync compromise) / High (token exposure, DLQ overflow with data loss risk, MFA bypass)
     / Medium/Low (degraded service, failed integrations without data exposure).
   - Reporting timeline: Critical/High → initial notification to NKIBK (nkibk.sk) within 24h;
     detailed report within 72h. Include: systems affected, estimated scope, immediate mitigations.
   - Internal escalation: who notifies NKIBK (DPO + IT lead jointly), who notifies patients
     if personal data is at risk (DPO, within 72h per GDPR Art. 34 if high risk to individuals).
   - Telemedicine-specific triggers: unauthorized video session access, join-token replay,
     TURN server misconfiguration exposing streams, HIS sync failure caused by a security event.
   - Contact: NKIBK hotline + email (add placeholder — ops to fill real contact before L9).
   - Post-incident: root cause analysis, patch, update pen-test scope, DPO review.

3. Create docs/MDR_SCOPE_EXCLUSION.md:
   - Title: EU MDR 2017/745 Scope Determination — Teleconsultation Software
   - Conclusion: The Nemocnica Snina telemedicine module is a general-purpose communication
     platform enabling human-to-human video consultation. It does not make autonomous clinical
     decisions, diagnose conditions, monitor physiological parameters, or recommend treatment.
     Clinical decisions are made exclusively by the licensed physician; the software is the
     communication channel only. Per MDCG 2019-11 guidance, this software is excluded from
     the scope of MDR as a medical device.
   - Scope review trigger: this determination must be reviewed if any of the following features
     are added: automated symptom analysis, AI-assisted diagnosis, vital sign monitoring,
     treatment recommendation engines, or any module that acts on clinical data without a
     physician in the loop.
   - Signature block: Quality/Regulatory lead + date (fill before L9 — this is a template).
   - Reference: MDCG 2019-11 "Guidance on Qualification and Classification of Software in
     Regulation (EU) 2017/745 — MDR and Regulation (EU) 2017/746 — IVDR".

Add all three documents to the L9 go/no-go gate in LAUNCH_CHECKLIST.md:
  [ ] RETENTION.md updated; HIS vendor 20-year retention confirmed in writing
  [ ] NIS2_INCIDENT_PROCEDURE.md: NKIBK contact filled, internal escalation contacts named
  [ ] MDR_SCOPE_EXCLUSION.md: signed by Quality/Regulatory lead
```
**Reference:** `TELEMEDICINE_COMPLIANCE_REVIEW.md`, `RETENTION.md`, `LAUNCH_CHECKLIST.md §L9`
**Done when:** RETENTION.md includes medical-records clarification and telemedicine rows; NIS2_INCIDENT_PROCEDURE.md covers classification, timelines, escalation, telemedicine triggers; MDR_SCOPE_EXCLUSION.md is a signable template; all three referenced in the L9 gate.

---

## Sprint S5 — Hardening & Verification Pass

**Goal:** Verify all probable gaps (⚠️ items in the gap table) are fully implemented, and close any minor UI/UX gaps from the prototype spec that may have been simplified during the build.

**Prompt:**
```
This is a verification + hardening sprint. Read design_handoff_nemocnica_snina/README.md and
compare the live staging site against the prototype HTML files. For each item below, either
confirm it is fully implemented (add a ✓ to this sprint's done-when list) or implement the
missing piece:

1. HOME PAGE SECTIONS (index.html):
   Verify all 5 sections are CMS-driven and rendering:
   (a) Emergency card — correct phone numbers from Hospital singleton; 112 link present.
   (b) Quick access — 3 cards linking to /oddelenia, /ambulancie, /lekari; arrow nudges on hover.
   (c) Accepting-new-patients band — 3 physician cards with accepting=true from CMS; green badge;
       physician bio; link to their department/clinic.
   (d) Featured departments — 3 cards with featured=true from CMS; 16:9 placeholder; beds chip.
   (e) News + APS — news list with badge per type (good=green, info=blue, alert=amber + left
       border); APS sidebar card with 4px top border --blue-600.

2. DEPARTMENT DETAIL (/oddelenia/[slug]):
   (a) Facilities checklist — 2-col green check list from department.facilities[].
   (b) Related physicians — avatar mini-cards for physicians in this department.
   (c) Sticky contact card (right sidebar) — phone, email, lead, deputy, visiting hours,
       "Book" + "How to find us" buttons. Sticky on desktop; static on mobile (below 940px).

3. PHYSICIAN DIRECTORY (/lekari):
   (a) Language tags — .lang-tag chips showing physician.langs[] on each card.
   (b) Language filter — "Filter by language" dropdown or chip set (in addition to the existing
       "Accepting new patients" checkbox).
   (c) Empty state message when filters return no results.

4. NEWS (/aktuality):
   Deep-link by #id — navigating to /aktuality#[newsId] scrolls to and highlights the target
   article (CSS :target highlight or brief JS animation, matching the prototype spec).

5. DISCLOSURES (/zverejnovanie):
   PDF download per row — verify the PDF download link renders and correctly serves the file
   attached in Strapi's media field for each disclosure. If the field is wired but the file
   attachment UI was not built in admin, add a "Attach PDF" file field to the disclosures
   editor in /admin.

6. CLINIC STATUS BADGES (/ambulancie):
   Verify all 4 status values render the correct badge (open=green, new=terra, alert=amber,
   closed=gray) and the legend is shown above the clinic list.

7. BOOKING RULE CALLOUTS:
   Verify each clinic card on /ambulancie shows the blue rule callout (bookingRule from CMS)
   when present; and that the "Book here" button is disabled + shows "Online booking
   unavailable" when bookable=false.

Report what was found (implemented / missing) and what was fixed.
```
**Reference:** `README.md §Screens`, prototype HTML files (index, oddelenia, oddelenie, ambulancie, lekari, aktuality, zverejnovanie)
**Done when:** all 7 items confirmed working or fixed; no regression on existing E2E specs; a brief findings report committed to `docs/S5_VERIFICATION_REPORT.md`.

---

## Telemedicine Sprints (S6–S11)

These sprints implement the telemedicine module defined in full in `TELEMEDICINE_BUILD_GUIDE.md`. Each sprint corresponds to one or two phases from that guide. Use the paste-ready prompts in that document — the entries below are the sprint-level wrappers.

**Driver prompt prefix (prepend to each telemedicine sprint prompt):**
```
Before starting, read these files in full:
  design_handoff_nemocnica_snina/TELEMEDICINE_README.md
  design_handoff_nemocnica_snina/TELEMEDICINE_ARCHITECTURE.md
  design_handoff_nemocnica_snina/TELEMEDICINE_DATA_MODEL.md
  design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md
  design_handoff_nemocnica_snina/TELEMEDICINE_CONFIG.md
  telehealth.html (UI reference — public landing page)
  teleconsult.html (UI reference — video consultation room)
Then execute the sprint task below, commit, and report done-when criteria.
```

---

### Sprint S6 — Telemedicine Foundations
**Phases:** T0.1 (DB migrations + Strapi extensions) + T0.2 (NestJS TelehealthModule + LiveKit adapter)
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T0.1` and `§T0.2`
**Key deliverables:** `telehealth_sessions`, `telehealth_intake`, `telehealth_summaries` tables; `clinics.telehealth` / `physicians.telehealth` in Strapi; `TelehealthSessionService`; LiveKit token issuance; mock provider for CI; status-transition enforcement at DB + service layer; `LIVEKIT_TURN_REGION` config validator check.
**Done when:** migrations apply cleanly; Strapi collections have new fields; `POST /telehealth/sessions/:id/join` returns a mock token in CI; illegal status transitions rejected; audit_log entries written; unit tests green.

---

### Sprint S7 — Patient Booking + Telehealth Landing Page
**Phases:** T1.1 (booking wizard `?mode=telehealth`) + T1.2 (public telehealth landing page)
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T1.1` and `§T1.2`
**Key deliverables:** `/[lang]/objednanie?mode=telehealth` flow with device check + telehealth consent; minor age block (under-16 blocked, 16–17 guardian checkbox); `/[lang]/telehealth` page matching `telehealth.html`; nav + footer links; telehealth privacy notice page; `clinics.telehealth` filter.
**Done when:** telehealth booking wizard completes end-to-end with consent stored; non-telehealth path unchanged; under-16 eID block works; telehealth page matches prototype; nav link present; hreflang updated.

---

### Sprint S8 — Video Consultation Room (Patient Side)
**Phase:** T1.3
**Full prompt:** `TELEMEDICINE_BUILD_GUIDE.md §T1.3`
**Key deliverables:** `/[lang]/telehealth/konzultacia/[sessionId]` matching `teleconsult.html` patient view; pre-call device check (`getUserMedia`); LiveKit `@livekit/client` SDK connection; waiting-room → active → post-call state machine; controls (mic toggle, camera toggle, screen share, end call); elapsed timer in `sessionStorage`; WCAG 2.1 AA; `aria-live` status region.
**Done when:** patient room loads, waits, activates on physician admit, shows post-call summary; camera/mic controls toggle; keyboard operability; axe zero violations on all 3 room states.

---

### Sprint S9 — Portal Teleconsultations + Physician Console
**Phases:** T1.4 (portal section) + T2.1 (physician schedule + doctor-side room)
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T1.4` and `§T2.1`
**Key deliverables:** "Teleconsultations" tab in patient portal (upcoming/past, join button active 10 min before, summary expand, PDF step-up 2FA gated); physician admin schedule (today + 7-day view); `/konzultacia/[id]?role=physician` doctor room (patient main tile, side panel with intake, admit button, MFA re-verify on join); post-call HIS save.
**Done when:** portal shows upcoming/past teleconsults; join button activates correctly; PDF download step-up gated; physician can admit patient; doctor room side panel renders intake data; MFA re-verified on join.

---

### Sprint S10 — HIS Integration + Full Compliance
**Phases:** T3.1 (HIS queue for `telehealth.session.ended`) + T3.2 (GDPR + compliance hardening)
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T3.1` and `§T3.2` (updated with compliance review items)
**Key deliverables:** FHIR Encounter written to HIS on session end; NCZI eZdravie prescription submission from video call (B2 from compliance review — extends S3 work to the telehealth path); `his_synced=false` purge guard; `TELEHEALTH_RECORDING_ENABLED` config validator; minor age block (R5); telehealth privacy notice link from booking wizard (R3); TURN region validator (R4); DPIA + HIS vendor retention + MDR gate items added to L9.
**Done when:** post-call FHIR Encounter in HIS sandbox; prescription code via eZdravie + SMS; idempotent HIS replay; recording blocked by config; minor blocked at API; privacy notice linked; TURN validator asserts EU; all L9 gate items from compliance review added.

---

### Sprint S11 — Admin Config + E2E Tests + Telemedicine Launch Gate
**Phases:** T4.1 (admin telehealth config) + T5.1 (E2E tests + launch gate update)
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T4.1` and `§T5.1`
**Key deliverables:** Admin "Telehealth" section (clinic/physician toggles, sessions overview, manual cancel); SPEC TH-1 through TH-6 Playwright specs green in CI; telemedicine items added to L9 gate; TH-Pilot soft-launch plan (FRO only, 2-week burn-in).
**Done when:** staff can toggle telehealth per clinic/physician; changes propagate to `/telehealth` page within `CONTENT_REVALIDATE_SECONDS`; all TH-1–TH-6 green in CI; L9 gate updated; TH-Pilot plan documented.

---

## Full Sprint Sequence & Owners

| Sprint | Dependency | Owner | Blocks |
|---|---|---|---|
| S1 — eDohody Completion | None | Backend | S6+ (shared queue infra) |
| S2 — APS Live Feed | None | Backend | L9 (APS accuracy) |
| S3 — Portal & Payment | None | Backend + Frontend | L9 (eZdravie is a legal blocker) |
| S4 — Compliance Docs | None | Backend (docs) + DPO/Regulatory (sign-off) | L9 gate |
| S5 — Hardening Pass | S1–S3 complete | Frontend | L9 |
| S6 — TH Foundations | S1 | Backend | S7–S11 |
| S7 — TH Booking + Landing | S6 | Full-stack | S8–S11 |
| S8 — TH Video Room Patient | S6, S7 | Frontend | S9 |
| S9 — TH Portal + Physician | S8 | Full-stack | S10 |
| S10 — TH HIS + Compliance | S9, S3 (eZdravie) | Backend | S11 |
| S11 — TH Admin + Tests | S10 | Full-stack | TH-Pilot launch |

**Parallel opportunities:** S1/S2/S3/S4 have no dependencies on each other — run them in separate Claude Code sessions simultaneously if capacity allows. S5 gates on S1–S3 being done.

---

## Driver prompt — start the next non-telemedicine session

```
Read the following files in full before writing any code:
  design_handoff_nemocnica_snina/SPRINT_BACKLOG.md
  design_handoff_nemocnica_snina/BUILD_GUIDE.md
  design_handoff_nemocnica_snina/PRODUCTION_ARCHITECTURE.md
  design_handoff_nemocnica_snina/DATA_MODEL.md
  design_handoff_nemocnica_snina/CLAUDE.md

Build state: commit 1c59502 is the current HEAD. All BUILD_GUIDE phases, COMPLETION_BRIEF,
PUNCHLIST, and LAUNCH_CHECKLIST BUILD tasks (L2–L8) are complete. OPS tasks L1/L4/L5/L6/L9
are outstanding (no code needed).

Execute Sprint [S1 / S2 / S3 / S4 / S5] from SPRINT_BACKLOG.md ONLY, then stop and report
what you changed and how the Done-when criteria are satisfied. Do not start the next sprint.
```
