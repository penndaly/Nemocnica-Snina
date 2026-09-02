# Sprint Backlog — Nemocnica Snina (Local Dev Running)

**Status:** Site running at `localhost:3000` · API at `localhost:4000` · Docker infrastructure healthy.

**Repo:** `https://github.com/penndaly/Nemocnica-Snina`

**Before starting any sprint — paste this context into Claude Code:**
```
Read design_handoff_nemocnica_snina/CONTEXT_PROMPT.md in full before writing any code.
The site is running locally: Next.js on localhost:3000, NestJS API on localhost:4000,
PostgreSQL/Redis/RabbitMQ via Docker. Local fixes already applied (auth.service.ts otplib,
his-sync.consumer.ts queue topology, config.schema.ts noChangeme, SkipLink.tsx, en/sk.json
portal key dedup). Execute Sprint [X] only, then stop and report Done-when criteria.
```

---

## Sprint S1 — eDohody Completion 🔴 HIGH

**What's missing:** RC is hashed (bcrypt, irreversible) so `ncziXml.generateEDohoda()` receives `'[REDACTED]'`. Admin review UI exists but SMS notification is absent.

```
Read apps/api/src/onboarding/onboarding.service.ts, nczi-xml.service.ts,
onboarding.controller.ts, and apps/web/src/app/admin/onboarding/ in full.

Fix three gaps:

1. RC ENCRYPTION at apply-time (AES-256-GCM):
   Add RC_ENCRYPTION_KEY to .env.example (🔴 secret, 32-byte hex).
   At POST /api/onboarding/apply: encrypt patientRc with AES-256-GCM using
   RC_ENCRYPTION_KEY; store ciphertext as patientRcEncrypted: String on the
   OnboardingApplication model (add Prisma migration). Keep patientRcHash for
   identity checks. Never log plaintext RC.
   At OnboardingService.review() on acceptance: decrypt patientRcEncrypted to
   get plaintext RC; pass to ncziXml.generateEDohoda(). The XML now has a real RC.
   Add RC_ENCRYPTION_KEY to the config validator: must be 32-byte hex in production.

2. SMS NOTIFICATION on accept/reject:
   On acceptance: SmsService.send(app.phone,
     SK: "Vaša žiadosť o registráciu u MUDr. [physicianName] bola schválená.
     Podpíšte digitálnu dohodu cez Slovensko.sk eID: [link]"
     EN: equivalent). Link = /[lang]/registracia/podpis?token=[uuid stored on app].
   On rejection: SmsService.send(app.phone, reason from reviewNote).
   Both audited.

3. VERIFY ADMIN UI at apps/web/src/app/admin/onboarding/:
   Confirm the list view shows masked RC hash, physician, insurer, date, status badge.
   Confirm detail view has Accept + Reject with required note textarea wired to
   POST /api/onboarding/:id/review. Editor role returns 403.
   Fix anything broken.

4. TESTS: accept produces XML with real RC (not [REDACTED]); SMS sent on accept;
   SMS sent on reject; editor role 403; RC encrypt/decrypt round trip.
```
**Done when:** acceptance generates XML with real RC; SMS sent on accept and reject; admin UI wired end-to-end; config validator covers RC_ENCRYPTION_KEY; tests green.

---

## Sprint S2 — APS Live Feed 🟡 MEDIUM

**What's missing:** `aps.service.ts` exists in the API but web pages (`[lang]/` and `[lang]/kontakt`) are not confirmed to call it — they may be rendering the static CMS `pages.aps` text only.

```
Read apps/api/src/aps/aps.service.ts, apps/api/src/aps/aps.controller.ts,
apps/web/src/app/[lang]/page.tsx, and apps/web/src/app/[lang]/kontakt/page.tsx.

1. Confirm GET /api/aps/schedule is reachable and returns ApsEntry[] with
   isFallback: boolean. Test: curl http://localhost:4000/api/aps/schedule

2. Update the home page [lang]/page.tsx to call /api/aps/schedule and render
   the live APS sidebar card (right column of the News+APS section). If
   isFallback=true show a subtle "Live schedule temporarily unavailable" note.

3. Update [lang]/kontakt/page.tsx to render the same live APS block (red left-
   border callout matching the kontakt.html prototype).

4. Update the smoke test (scripts/smoke-test.ts §APS) to verify /api/aps/schedule
   returns 200 with parseable ApsEntry[], not just URL reachability.

5. Add to TELEMEDICINE_CONFIG.md monitoring section: alert if APS cache age > 2×TTL.
```
**Done when:** home + kontakt pages show live APS data; Redis caching confirmed; CMS fallback renders on forced failure; smoke test checks parsed data.

---

## Sprint S3 — Portal & Payment Completion 🔴 HIGH (eZdravie is legal)

```
Read design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md §B2,
README.md §Patient portal, and COMPLETION_BRIEF.md §D1.

PART A — NCZI eZdravie prescription routing (Act 362/2011 — legal blocker):
In apps/api/src/his/his-sync.consumer.ts, after writing a FHIR MedicationRequest
to HIS, submit to NCZI eZdravie (NCZI_EDOHODY_ENDPOINT / NCZI_API_KEY).
Store the returned prescription code as MedicationRequest.identifier
(system: 'urn:oid:nczi.ezdravia'). Send the code to the patient via SMS.
If eZdravie fails: dead-letter separately; retry + DLQ; never block booking.
Audit all attempts.

PART B — Portal refill request:
In apps/web/src/app/[lang]/portal/: add "Request refill" button on each
MedicationRequest card with refills > 0.
POST /api/portal/refill { medicationRequestId } → publishes
portal.refill.requested to RabbitMQ → HIS sync routes to physician inbox.
Rate-limit: 1 per medication per 7 days (Redis key). aria-live response.
Audited.

PART C — Appointments tab cancel link:
On each FHIR Appointment card: show "Cancel appointment" link.
GET /api/portal/appointments/:fhirId/cancel-token → returns cancelToken
if the appointment belongs to the authenticated patient →
deep-links to /[lang]/objednanie/zrusit/[token].

PART D — Payment receipts:
On successful payment webhook: generate PDF receipt (patient name, item,
amount, date, ICO/DIC, transaction ref) via Gotenberg or Puppeteer (EU only).
Store path in payment_receipts table (transactionRef, bookingId, pdfPath, createdAt).
Add "Download receipt" to booking confirmation step 5 and a "Payments" tab
in the portal. Patient session required (not step-up 2FA). Audited.
```
**Done when:** prescriptions route via eZdravie with DLQ fallback; refill queues to HIS; portal appointments show cancel links; receipts downloadable from portal; eZdravie failure never blocks booking confirmation.

---

## Sprint S4 — Compliance Documentation 🔴 HIGH

```
Read design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md §B3, §R1, §R6
and the existing RETENTION.md.

1. Update RETENTION.md — add Medical Records section:
   FHIR Encounter in HIS = 20 years (Act 576/2004 §24) — HIS vendor's obligation;
   our DB holds operational metadata only. Add telehealth rows from
   TELEMEDICINE_DATA_MODEL.md §Retention. Rule: never purge telehealth_summaries
   where his_synced=false. Add to LAUNCH_CHECKLIST.md §L7: HIS vendor confirms
   20-year FHIR Encounter retention in writing.

2. Create docs/NIS2_INCIDENT_PROCEDURE.md:
   Scope: essential entity (NIS2 + Act 69/2018). Severity classification
   (Critical/High/Medium/Low with telemedicine triggers). Reporting timeline
   (24h initial alert → 72h detailed report to NKIBK). Internal escalation
   (DPO + IT lead). Patient notification threshold (GDPR Art. 34). NKIBK
   contact placeholder (ops to fill). Post-incident process.

3. Create docs/MDR_SCOPE_EXCLUSION.md:
   Template for Quality/Regulatory to sign. Human-to-human communication tool;
   no autonomous clinical decisions; excluded from MDR per MDCG 2019-11.
   Scope review triggers. Signature block.

Add all three to LAUNCH_CHECKLIST.md §L9 gate:
  [ ] RETENTION.md updated; HIS vendor 20-year retention confirmed
  [ ] NIS2_INCIDENT_PROCEDURE.md: NKIBK contact filled
  [ ] MDR_SCOPE_EXCLUSION.md: signed by Quality/Regulatory
```
**Done when:** RETENTION.md updated; NIS2 procedure covers telemedicine triggers; MDR template signable; all three in L9 gate.

---

## Sprint S5 — UI/UX Verification Pass 🟡 MEDIUM

```
Read design_handoff_nemocnica_snina/README.md §Screens. Compare localhost:3000
against the prototype HTML files. Verify and fix each item. Report findings in
docs/S5_VERIFICATION_REPORT.md:

1. HOME PAGE — all 5 sections CMS-driven:
   (a) Emergency card: phone numbers from Hospital singleton; 112 link.
   (b) Quick access: 3 cards → /oddelenia, /ambulancie, /lekari; hover arrow.
   (c) Accepting-new-patients: 3 physician cards accepting=true; green badge.
   (d) Featured departments: 3 cards featured=true; 16:9 placeholder; beds chip.
   (e) News + APS: badges (good=green, info=blue, alert=amber+left border); APS card.

2. DEPARTMENT DETAIL:
   (a) Facilities checklist: 2-col green-check list from department.facilities[].
   (b) Related physicians: avatar mini-cards.
   (c) Sticky contact card: phone/email/lead/deputy/visiting hours/buttons.
       Sticky desktop; static mobile (<940px).

3. PHYSICIAN DIRECTORY:
   (a) Language tags (.lang-tag chips) from physician.langs[].
   (b) Language filter alongside "accepting new patients" checkbox.
   (c) Empty state message when filters return no results.

4. NEWS: deep-link /aktuality#[id] scrolls to and highlights target article.

5. DISCLOSURES: PDF download per row works; admin has "Attach PDF" file field.

6. CLINIC CARDS: 4 status badges + legend; booking rule callout; disabled button
   when bookable=false.

For each: ✓ confirmed / ✗ found missing (fix it). Commit with report.
```
**Done when:** all 7 items confirmed or fixed; no E2E regression; docs/S5_VERIFICATION_REPORT.md committed.

---

## Telemedicine Sprints S6–S11

**Read before starting any telemedicine sprint:**
```
design_handoff_nemocnica_snina/TELEMEDICINE_README.md
design_handoff_nemocnica_snina/TELEMEDICINE_BUILD_GUIDE.md
design_handoff_nemocnica_snina/TELEMEDICINE_DATA_MODEL.md
design_handoff_nemocnica_snina/TELEMEDICINE_ARCHITECTURE.md
design_handoff_nemocnica_snina/TELEMEDICINE_CONFIG.md
design_handoff_nemocnica_snina/TELEMEDICINE_COMPLIANCE_REVIEW.md
design_handoff_nemocnica_snina/TELEMEDICINE_E2E_TESTS.md
telehealth.html    ← public landing page prototype
teleconsult.html   ← video room prototype (3 states × 2 views)
```

### Sprint S6 — Telemedicine Foundations
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T0.1` + `§T0.2`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T0.1 and §T0.2 in full. Execute both phases:

T0.1 — Database migrations + Strapi extensions:
- Prisma migrations: telehealth_sessions, telehealth_intake, telehealth_summaries
  (all columns per TELEMEDICINE_DATA_MODEL.md; status-transition CHECK constraint).
- Strapi: add clinics.telehealth (Boolean), clinics.telehealthWindow (Short Text),
  clinics.telehealthRule (Internationalized); physicians.telehealth (Boolean);
  pages.telehealth singleton (hero.badge, hero.title, hero.subtitle bilingual).
- Seed telehealth=true on clinics [interne, fro, angiology] via Strapi admin.
- Config validator additions per TELEMEDICINE_CONFIG.md:
  TELEHEALTH_PROVIDER≠mock in prod; LIVEKIT_URL starts wss://;
  LIVEKIT_TURN_REGION non-empty EU; recording gate.
- Add all TELEMEDICINE_CONFIG.md env vars to .env.example.

T0.2 — NestJS TelehealthModule:
- VideoProviderService interface + LiveKit adapter + mock provider (TELEHEALTH_PROVIDER=mock).
- TelehealthSessionService: createSession, joinSession, admitPatient, endSession,
  handleNoShow (scheduled job every 5 min).
- All REST endpoints from TELEMEDICINE_ARCHITECTURE.md §API surface.
- audit_log entry on every action.
- Unit tests: token issuance, status transitions reject illegal moves, no-show job.
```
**Done when:** migrations apply; Strapi fields present; join endpoint returns mock token in CI; illegal transitions rejected; audit entries written; unit tests green.

---

### Sprint S7 — Patient Booking + Telehealth Landing Page
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T1.1` + `§T1.2`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T1.1 and §T1.2 and telehealth.html (UI reference).

T1.1 — Booking wizard ?mode=telehealth:
- /[lang]/objednanie?mode=telehealth: Step 1 shows only telehealth=true clinics;
  Step 2 uses telehealthWindow; Step 3 labels slots "Video"; Step 4 adds
  getUserMedia device-check callout + mandatory telehealth GDPR consent checkbox
  (booking_consents.consent_type='telehealth_medical_record'); Step 5 adds
  "Join consultation" button (active 10 min before scheduled_at).
- Server enforces: mode=telehealth rejected for telehealth=false clinics;
  consent absence blocks confirm (403 consent_required).
- Minor block: eID age < 16 → 403 + redirect; age 16-17 → guardian co-presence
  checkbox; all blocks logged to audit_log.
- On booking.confirmed with mode=telehealth: emit telehealth.booking.confirmed
  → TelehealthSessionService.createSession().

T1.2 — Public telehealth landing page:
- /[lang]/telehealth matching telehealth.html pixel-for-pixel.
  Hero from Strapi pages.telehealth singleton; eligible clinics from Strapi
  telehealth=true with ISR. All other sections from i18n catalog (SK+EN).
- Add "Telehealth" nav link in SiteHeader between Services and Diagnostics.
- Add to footer "For patients" column.
- Telehealth privacy notice at /[lang]/telehealth/sukromie (GDPR Art. 13).
- hreflang updated for new route.
```
**Done when:** telehealth booking completes end-to-end; consent stored; under-16 blocked at API; /sk/telehealth matches prototype; nav link present; hreflang updated.

---

### Sprint S8 — Video Consultation Room (Patient Side)
**Full prompt:** `TELEMEDICINE_BUILD_GUIDE.md §T1.3`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T1.3 and teleconsult.html (patient view).

Build /[lang]/telehealth/konzultacia/[sessionId] — eID/OIDC protected:

1. Pre-call device check: getUserMedia; error card with clinic phone on denial;
   sessionStorage th_device_ok.

2. POST /telehealth/sessions/:id/join → LiveKit token; verify session belongs to
   patient; terminal state card on cancelled/ended/no_show.

3. LiveKit @livekit/client SDK: connect → waiting room (room.admitted event) →
   active call → end → post-call. Fetch summary GET /sessions/:id/summary.

4. Controls: mic toggle (aria-pressed), camera toggle, screen share,
   end call (Escape → confirmation dialog, Enter/Space confirm).

5. Elapsed timer from sessionStorage th_start; state in sessionStorage th_room_state.

6. aria-live="polite" region for status changes; focus management on transitions;
   keyboard-operable throughout.

7. Post-call overlay: patient view — summary items, "View in portal", "Book follow-up".

Matches teleconsult.html patient view exactly.
axe WCAG 2.1 AA: zero violations on waiting / active / postcall states.
```
**Done when:** patient can join, wait, go live on admit, end call, see post-call summary; keyboard fully operable; axe zero violations.

---

### Sprint S9 — Portal Teleconsultations + Physician Console
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T1.4` + `§T2.1`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T1.4 and §T2.1 and teleconsult.html (doctor view).

T1.4 — Portal teleconsultations section:
- Add "Teleconsultations" nav item in patient portal (between Overview and Health records).
- Upcoming tab: query telehealth sessions for patient; join button active 10 min before;
  countdown label; cancel link.
- Past tab: "View summary" inline expand + "Download summary PDF" (step-up 2FA gated,
  audit_log entry on download).
- Empty states with "Book a telehealth appointment" CTA.

T2.1 — Physician console:
- Admin /admin "Telehealth" sub-section (clinician/admin role): today + 7-day schedule;
  "Join call" + "View intake" per row.
- /konzultacia/[id]?role=physician — staff OIDC + MFA re-verify at join endpoint:
  patient in main tile; self PiP; side panel (intake data: reason, medications,
  symptoms, vitals); "Admit patient" button (POST /sessions/:id/admit);
  post-call: clinical note editable + "Save to HIS" triggers telehealth.session.ended.
```
**Done when:** portal shows upcoming/past; join activates at correct time; PDF step-up gated; physician can admit; doctor room renders intake; MFA re-verified on physician join.

---

### Sprint S10 — HIS Integration + Full Compliance
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T3.1` + `§T3.2`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T3.1, §T3.2, and TELEMEDICINE_COMPLIANCE_REVIEW.md.

T3.1 — HIS queue for telehealth.session.ended:
Extend his-sync.consumer.ts to consume telehealth.session.ended:
- Write FHIR Encounter (status=finished, class=VR, period, participants).
- Write FHIR MedicationRequest + NCZI eZdravie code (extends S3 eZdravie work).
- Write proposed FHIR Appointment if follow_up_recommendation present.
- Set his_synced=true; store his_encounter_id. Idempotent. DLQ + retry.
- Purge guard: telehealth_summaries rows with his_synced=false never eligible for purge
  (DB partial index or application guard).

T3.2 — Compliance hardening (all items from TELEMEDICINE_COMPLIANCE_REVIEW.md):
- TELEHEALTH_RECORDING_ENABLED=false enforced; DPO gate (TELEHEALTH_RECORDING_DPO_APPROVED).
- LIVEKIT_TURN_REGION EU assertion in config validator.
- Consent gate: POST /sessions/:id/join returns 403 if telehealth_medical_record absent.
- Minor gate: POST /sessions/:id/join returns 403 if eID age < 16.
- Telehealth privacy notice linked from booking Step 4 consent checkbox.
- L9 gate additions: DPIA, HIS 20-year retention, DPAs, MDR exclusion,
  telemedicine pen-test items (token isolation, room admission, PDF isolation,
  TURN geography, unauthenticated WebSocket).
```
**Done when:** post-call FHIR Encounter in HIS sandbox; prescription via eZdravie + SMS; idempotent replay; recording blocked; consent + minor gates; privacy notice linked; L9 gate updated.

---

### Sprint S11 — Admin Config + E2E Tests + Launch Gate
**Full prompts:** `TELEMEDICINE_BUILD_GUIDE.md §T4.1` + `§T5.1`

```
Read TELEMEDICINE_BUILD_GUIDE.md §T4.1, §T5.1, and TELEMEDICINE_E2E_TESTS.md.

T4.1 — Admin telehealth config:
- Admin "Telehealth" section: Clinics subview (telehealth toggle → Strapi, video window,
  bilingual bookingRule); Physicians subview (telehealth toggle); Sessions overview
  (today + 7 days, anonymised patient_token, manual cancel with reason + SMS + audit).
- Editor role blocked from Sessions view.
- All changes audited; clinic/physician toggles propagate within CONTENT_REVALIDATE_SECONDS.

T5.1 — E2E tests + launch gate:
- Implement SPEC TH-1 through TH-6 from TELEMEDICINE_E2E_TESTS.md.
- axe WCAG 2.1 AA on /sk/telehealth and room route (all 3 states).
- Wire into CI after main E2E suite; both must be green before telemedicine launch.
- TH-Pilot soft-launch plan: telehealth for FRO only; 2-week burn-in; then expand.
- Update LAUNCH_CHECKLIST.md §L9 gate with all telemedicine items.
- Add monitoring: session join failure rate, admission latency, post-call HIS sync DLQ,
  PDF generation failures, LiveKit SFU uptime, recording-flag synthetic check.
```
**Done when:** TH-1–TH-6 green in CI; L9 gate updated; TH-Pilot plan documented; monitoring alerts added.

---

## Dependency map

```
S1 (eDohody)    ─┐
S2 (APS)        ─┤──> S5 (verify) ──> L9 go-live
S3 (portal)     ─┘
S4 (compliance) ──────────────────────> L9 gate docs

S1 ──> S6 ──> S7 ──> S8 ──> S9 ──> S10 ──> S11 ──> TH-Pilot
S3 (eZdravie) ──────────────────────────────> S10
S4 ─────────────────────────────────────────> S10
```

**Parallel:** S1 / S2 / S3 / S4 can run simultaneously in separate Claude Code sessions.
S5 gates on S1–S3. S6–S11 are sequential.
