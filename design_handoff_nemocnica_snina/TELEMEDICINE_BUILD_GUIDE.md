# Telemedicine Build Guide — Nemocnica Snina (prompt by prompt)

This is the **Claude Code build playbook** for the telemedicine module. It follows the same conventions as `BUILD_GUIDE.md` — dependency-ordered phases, paste-ready prompts, **Done-when** criteria. Work through it **in order**. Each prompt assumes the base platform (Phases 0–9 of `BUILD_GUIDE.md`) is complete and running.

> **Before starting:** Read `TELEMEDICINE_README.md`, `TELEMEDICINE_DATA_MODEL.md`, `TELEMEDICINE_ARCHITECTURE.md`, and `TELEMEDICINE_CONFIG.md` in full. These are the source of truth. The prototype files `telehealth.html` and `teleconsult.html` are the canonical UI references.

---

## Phase T0 — Foundations

### T0.1 — Database migrations + Strapi config extensions

**Goal:** Add the new tables and extend existing collections before any feature code is written.

**Prompt:**
```
Read TELEMEDICINE_DATA_MODEL.md in full. Then:

1. Write PostgreSQL migrations (via DATABASE_MIGRATION_URL) to create:
   - telehealth_sessions   (all columns + indexes on booking_id, clinic_id, physician_id, status, scheduled_at)
   - telehealth_intake     (session_id FK)
   - telehealth_summaries  (session_id FK; pdf_path nullable)
   All three: append-only audit pattern — the app DB role has INSERT+SELECT; no UPDATE except on
   telehealth_sessions.status (only the allowed transitions: scheduled→waiting, waiting→active,
   active→ended, any→cancelled, scheduled→no_show). Enforce transitions with a CHECK or trigger.

2. In Strapi, add to the clinics content type:
   - telehealth (Boolean, default false)
   - telehealthWindow (Short Text, optional)
   - telehealthRule (Internationalized Short Text, SK+EN, optional)
   Add to the physicians content type:
   - telehealth (Boolean, default false)

3. Add a telehealth page singleton in Strapi pages (hero.badge, hero.title, hero.subtitle — all
   bilingual SK+EN) so staff can edit the landing-page copy without a deploy.

4. Seed telehealth:true on clinics [interne, fro, angiology] and their corresponding physicians
   in the Strapi admin.

5. Add TELEMEDICINE_CONFIG.md env vars to .env.example (placeholders only) and extend the
   startup config validator to check them.
```
**Reference:** `TELEMEDICINE_DATA_MODEL.md`, `TELEMEDICINE_CONFIG.md`, `CONFIG_AND_ENV.md`
**Done when:** migrations run cleanly; Strapi collections have the new fields; seed data set; config validator covers all new vars; status-transition constraint rejects illegal moves.

---

### T0.2 — Video provider integration (LiveKit adapter)

**Goal:** The NestJS `TelehealthModule` can issue and revoke join tokens; the LiveKit SFU is reachable.

**Prompt:**
```
Read TELEMEDICINE_ARCHITECTURE.md §Video infrastructure and §API surface. Build the NestJS
TelehealthModule with:

1. A VideoProviderService (interface + LiveKit adapter) that:
   - Creates a LiveKit room on session creation (idempotent — room may already exist).
   - Issues a short-lived AccessToken (TTL = TELEHEALTH_SESSION_TTL_SECONDS) for a given
     participant identity and room.
   - Revokes a token by removing the participant from the room.
   - The interface is provider-agnostic (VideoProviderService.issueToken, .revokeToken,
     .getRoomStatus) so we can swap providers without changing the module.

2. A TelehealthSessionService with:
   - createSession(bookingId): called when booking.confirmed is emitted for a telehealth booking;
     creates a telehealth_sessions row (status=scheduled), creates the LiveKit room.
   - joinSession(sessionId, identity, role): verifies auth, checks status is not cancelled/ended,
     issues a join token, writes audit_log entry, returns { token, wsUrl }.
   - admitPatient(sessionId, physicianId): transitions waiting→active; writes audit_log.
   - endSession(sessionId, actorId): transitions active→ended; emits telehealth.session.ended
     to RabbitMQ; writes audit_log.
   - handleNoShow(): scheduled job — every 5 min, mark sessions where no patient joined within
     +15 min of scheduled_at as no_show; notify physician by SMS.

3. The REST endpoints listed in TELEMEDICINE_ARCHITECTURE.md §API surface. Auth: patient endpoints
   require eID OIDC session; physician endpoints require staff OIDC + MFA.

4. A local mock provider (TELEHEALTH_PROVIDER=mock) that returns stub tokens for dev/CI.

5. Unit tests: token issuance, status-transition enforcement (illegal transitions throw), no-show
   job, idempotent room creation.
```
**Reference:** `TELEMEDICINE_ARCHITECTURE.md`, `TELEMEDICINE_DATA_MODEL.md`
**Done when:** `POST /telehealth/sessions/:id/join` returns a token (mock in CI); illegal status transitions are rejected at the service layer; no-show job runs; audit_log entries written; unit tests green.

---

## Phase T1 — Patient-facing flows

### T1.1 — Booking wizard extension (telehealth mode)

**Goal:** Patients can book a "Video consultation" through the existing objednanie flow.

**Prompt:**
```
Read TELEMEDICINE_README.md §Booking wizard — delta spec. Extend the booking wizard
(/[lang]/objednanie?mode=telehealth) so that:

1. Step 1 shows only clinics where telehealth:true. Each clinic card shows a "Video consultation"
   chip (--blue-50/--blue-700 colours from the design system).

2. Step 2 uses the clinic's telehealthWindow (if set) instead of the full bookingWindow for date
   filtering. The date card labels the window "Video" in a small chip.

3. Step 3 labels time slots "Video consultation" instead of a physical room.

4. Step 4 adds below the standard patient form:
   - A camera/mic device-check callout component (green "Ready" if permissions granted,
     amber "Please allow camera access" if not; uses getUserMedia probe).
   - A mandatory telehealth GDPR consent checkbox (distinct from the base GDPR consent):
     "Súhlasím so zavedením záznamu z videokonzultácie do mojej zdravotnej dokumentácie v súlade
     s §18 zákona č. 576/2004 Z. z." Store as booking_consents.consent_type='telehealth_medical_record'.
   Booking cannot be confirmed without this consent.

5. Step 5 confirmation card adds:
   - A "Join consultation" button (disabled; becomes active 10 min before scheduled_at).
   - Instructions: "The link will be active 10 minutes before your appointment."

6. On booking.confirmed (existing queue event): if booking.mode === 'telehealth', emit a
   telehealth.booking.confirmed event that TelehealthSessionService.createSession() consumes.

All existing non-telehealth booking paths must be unchanged. All new copy is bilingual SK+EN.
Server-side: enforce that ?mode=telehealth is only accepted for clinics with telehealth:true.
```
**Reference:** `TELEMEDICINE_README.md`, `objednanie.html`, `TELEMEDICINE_ARCHITECTURE.md`
**Done when:** end-to-end booking of a Video consultation works; telehealth consent stored; device check renders; non-telehealth booking untouched; server rejects telehealth mode for non-enabled clinics.

---

### T1.2 — Public telehealth landing page

**Goal:** `/[lang]/telehealth` — the promotional entry point, matching `telehealth.html` exactly.

**Prompt:**
```
Build the public telehealth landing page at /[lang]/telehealth, matching telehealth.html pixel-
for-pixel. It is a CMS-driven page: the hero badge/title/subtitle come from the Strapi
pages.telehealth singleton (seeded in T0.1). The eligible-clinics grid reads from the CMS
clinics collection filtered to telehealth:true with ISR (CONTENT_REVALIDATE_SECONDS). Remaining
sections (How it works, Requirements, Legal note, CTA band) are static i18n strings (SK+EN from
the message catalog). Add a nav link "Telehealth" to the site header between "Services" and
"Diagnostics" (update the nav item list in the shared layout). Add "Telehealth" to the footer
"For patients" column. All links use locale-prefixed routes; hreflang updated.
```
**Reference:** `telehealth.html`, `TELEMEDICINE_README.md §Public landing`, `README.md §Global chrome`
**Done when:** `/sk/telehealth` and `/en/telehealth` match the prototype; eligible clinics come from Strapi; CMS edit updates the hero; nav link present; hreflang updated.

---

### T1.3 — Video consultation room (patient side)

**Goal:** `/[lang]/telehealth/konzultacia/[sessionId]` — the browser-based room for patients.

**Prompt:**
```
Build the video consultation room at /[lang]/telehealth/konzultacia/[sessionId], matching
teleconsult.html (patient view). This is a protected route: requires an active eID/OIDC patient
session. On load:

1. Pre-call device check: request camera+mic permissions. If denied, show the error card with
   clinic phone number. Persist permission state in sessionStorage (th_device_ok).

2. Call GET /telehealth/sessions/:id/join to get the LiveKit token and wsUrl. Verify the session
   belongs to the authenticated patient. If status is cancelled/ended/no_show, show the
   appropriate terminal state.

3. Connect to LiveKit using the @livekit/client SDK. Show the waiting room overlay (teleconsult.html
   "waiting" state) until the physician admits the patient (room.admitted event → transition to
   "active" state).

4. Active call: render the main physician video tile + self PiP, controls bar. Controls: mic
   toggle, camera toggle, screen share (LiveKit.setScreenShareEnabled), end call.

5. Post-call: on room.disconnected or end-call, show the post-call overlay (patient view from
   prototype). Fetch the summary from GET /telehealth/sessions/:id/summary and render the items.

6. Timer: started at room.admitted; elapsed time in sessionStorage (th_start) for refresh persistence.

7. All text bilingual SK/EN from the i18n catalog; aria-labels on all controls; aria-live region
   for status changes; keyboard: Tab/Space/Enter controls, Escape = end call with confirmation.
```
**Reference:** `teleconsult.html`, `TELEMEDICINE_ARCHITECTURE.md §WebRTC signaling flow`, `§Accessibility`
**Done when:** patient can join, wait, go live, end call, and see post-call summary; device check works; controls are keyboard-accessible; WCAG 2.1 AA passes axe on the room route.

---

### T1.4 — Portal teleconsultations section

**Goal:** Patient portal shows upcoming and past teleconsults.

**Prompt:**
```
Add a "Teleconsultations" (SK: "Telekonzultácie") item to the patient portal left nav between
"Overview" and "Health records". Content:

- Upcoming tab: query GET /telehealth/sessions?patient=me&status=scheduled,waiting,active.
  Card per session: physician name + specialty, date/time chip, status badge, "Join" button
  (href to /telehealth/konzultacia/:id; disabled until 10 min before scheduled_at with a
  countdown label "Active in Xm"), "Cancel" link (triggers booking cancellation flow).

- Past tab: query GET /telehealth/sessions?patient=me&status=ended,no_show.
  Card per session: date, physician, duration chip, "View summary" (inline expand) +
  "Download summary PDF" button (step-up 2FA gated — same pattern as lab-result PDF download).

- Empty states with "Book a telehealth appointment" CTA linking to /objednanie?mode=telehealth.

Match the portal's existing card/nav/tab visual vocabulary exactly (portal.html reference).
All data comes from the API; nothing is seeded or mocked in the portal UI.
```
**Reference:** `portal.html`, `TELEMEDICINE_README.md §Patient portal — delta spec`
**Done when:** portal nav shows the new item; upcoming and past tabs render correctly from API; join button activates at the right time; PDF download is step-up gated.

---

## Phase T2 — Physician console

### T2.1 — Physician schedule + room (doctor side)

**Goal:** Physicians can see their teleconsult schedule and conduct the call from their side.

**Prompt:**
```
Build the physician-side teleconsult experience:

1. In the admin CMS (/admin), add a "Telehealth" section (clinician/admin role only) showing:
   - Today's teleconsult schedule: list of telehealth_sessions for the logged-in physician,
     sorted by scheduled_at. Columns: time, patient token (anonymised — no name in the CMS),
     status badge, "Join call" button, "View intake" link.
   - A 7-day calendar view of upcoming sessions.

2. The physician room at /[lang]/telehealth/konzultacia/[sessionId]?role=physician
   (protected: staff OIDC + MFA required):
   - Matches teleconsult.html doctor view: patient in main tile, self PiP, side panel showing
     the telehealth_intake record (reason, medications, symptoms, vitals note).
   - "Admit patient" button in the waiting-room state (calls POST /sessions/:id/admit).
   - Controls bar identical to the patient side.
   - Post-call overlay (doctor view): "Save record to HIS" button (triggers telehealth.session.ended
     event to queue), e-prescription issued badge (if prescription_issued=true), follow-up
     recommendation field (pre-filled from summary). Physician can edit the clinical_note before
     saving.

3. Physician join token: issued via POST /sessions/:id/join with role=physician; requires MFA
   verification on the join endpoint (re-check TOTP token, not just session).
```
**Reference:** `teleconsult.html` (doctor view), `TELEMEDICINE_ARCHITECTURE.md §Token issuance rules`
**Done when:** physician can see their schedule, admit patients, conduct the call, and submit a post-call summary that triggers the HIS sync queue event; MFA re-verification on join; audit_log entries present.

---

## Phase T3 — HIS integration + compliance

### T3.1 — HIS queue consumer for telehealth events

**Goal:** Post-call clinical data reaches the HIS via the existing async queue — never a direct write.

**Prompt:**
```
Extend the HIS sync agent (built in COMPLETION_BRIEF §C2) to consume the new
telehealth.session.ended event. On receipt:

1. Write a FHIR R4 Encounter (status=finished, class=VR "virtual", period.start/end from
   session times, participant = physician FHIR reference, subject = patient FHIR reference from
   the eID identity context).

2. If telehealth_summaries.prescription_issued=true, write a FHIR MedicationRequest referencing
   the Encounter.

3. If a follow_up_recommendation is present, write a proposed FHIR Appointment.

4. Update telehealth_sessions.his_synced = true and store the FHIR Encounter.id in
   telehealth_summaries.his_encounter_id.

5. Idempotency: keyed on session_id — if his_synced=true, skip and ack.
   Dead-letter handling: same retry + DLQ pattern as existing booking events.
   Audit: log every attempt (success or failure) to audit_log.

Provide a HIS sandbox mock that accepts these FHIR resources and returns synthetic IDs.
```
**Reference:** `TELEMEDICINE_ARCHITECTURE.md §telehealth.session.ended queue event`, `PRODUCTION_ARCHITECTURE.md §HIS`
**Done when:** post-call summary reaches HIS FHIR sandbox as an Encounter; idempotent replay works; DLQ handles HIS outage; audit_log records every attempt.

---

### T3.2 — GDPR + compliance hardening for telemedicine (updated per compliance review)

**Goal:** Close the GDPR delta items specific to video, extend the pen-test scope, and update RETENTION.md.

**Prompt:**
```
Read TELEMEDICINE_COMPLIANCE_REVIEW.md in full before starting. Address all 🔴 Blocker and 🟡 Required items that are build tasks (B2, R1 partial, R3, R4, R5). Items B1, B3, R2, R6 are owner=DPO/Ops/Regulatory — flag them clearly and add their gate items to LAUNCH_CHECKLIST.md but do not block the build on them.

1. Confirm TELEHEALTH_RECORDING_ENABLED=false is enforced by the config validator in production.
   Add a check: if TELEHEALTH_RECORDING_ENABLED=true AND TELEHEALTH_RECORDING_DPO_APPROVED!=true,
   the validator fails fast with a clear message.

2. Verify telehealth consent (booking_consents.consent_type='telehealth_medical_record') is
   collected at booking and its absence blocks session join (API returns 403 with reason: consent_required).

3. Extend RETENTION.md with telehealth retention periods (CRITICAL DISTINCTION — Act 576/2004 §24):
   - telehealth_sessions / telehealth_intake: 5 years — these are OPERATIONAL METADATA, not the
     medical record. The authoritative medical record is the FHIR Encounter in HIS.
   - telehealth_summaries: 5 years in DB; pdf_path files purged 7 days after his_synced=true.
     NEVER purge a row where his_synced=false. Add a DB-level guard (partial index or CHECK).
   - HIS FHIR Encounter: 20 years (Act 576/2004 §24) — retention is the HIS vendor's obligation;
     confirm contractually. Add to LAUNCH_CHECKLIST.md §L7.
   - provider join tokens: ephemeral — never persisted beyond sessionStorage.

4. Add ALL pen-test items to LAUNCH_CHECKLIST.md §L6:
   - Existing telemedicine items from TELEMEDICINE_ARCHITECTURE.md §Pen-test scope additions.
   - NIS2/R1: verify TURN server geography (all ICE candidates are EU-resident).
   - NIS2/R1: verify incident detection covers the video module (unauthorized session access,
     token replay, HIS sync failure triggered by a security event).

5. Verify all telehealth audit_log coverage: token issuance, session state transitions, intake
   submission, summary access, PDF download, minor access block. Add any missing log points.

6. NCZI eZdravie prescription submission (B2): extend the post-call flow so that when
   prescription_issued=true, the API submits to NCZI eZdravie and stores the returned
   prescription code in telehealth_summaries.prescription_ref. The FHIR MedicationRequest in
   HIS must include this code as identifier (urn:oid:nczi.ezdravia). Patient receives the code
   via the existing SMS gateway. Confirm with Hospital IT that eZdravie accepts VR encounter type.

7. Telehealth privacy notice (R3): build a /[lang]/telehealth/sukromie page (or kontakt.html
   #telehealth-gdpr section) covering controller identity, Art. 9(2)(h) lawful basis, data flows,
   sub-processors (LiveKit, PDF service), no-recording default, retention periods, patient rights,
   DPO contact. Link it from the telehealth consent checkbox in booking Step 4.

8. TURN server enforcement (R4): add LIVEKIT_TURN_REGION to .env.example and the config
   validator. Assert non-empty, non-US-region in production. For livekit.io cloud, request
   written confirmation of EU-only TURN in the DPA.

9. Minor access block (R5): in the booking wizard, check eID-verified age at Step 4. If under 16,
   block telehealth booking and display redirect message. For 16–17: add guardian co-presence
   checkbox. Log all minor access blocks to audit_log.

10. LAUNCH_CHECKLIST.md §L9 gate additions (flag as owner=DPO/Ops/Regulatory — do not block
    the build, but ensure these are visible):
    [ ] DPIA completed and signed by DPO (B1)
    [ ] HIS vendor confirms 20-year FHIR Encounter retention in writing (B3)
    [ ] DPAs signed for LiveKit (cloud) and PDF service (R2)
    [ ] MDR scope exclusion document signed by Quality/Regulatory (R6)
    [ ] NIS2 incident reporting procedure documented and NKIBK contact registered (R1)

6. Accessibility: run axe on /telehealth, /telehealth/konzultacia/[sessionId] (waiting, active,
   postcall states). Fix any violations. Verify aria-live status region, aria-pressed on controls,
   keyboard operability, Escape key confirmation dialog.
```
**Reference:** `TELEMEDICINE_ARCHITECTURE.md §Security & compliance`, `COMPLETION_BRIEF.md §A3`
**Done when:** recording flag enforced; consent blocks join; RETENTION.md updated; L6 scope extended; all audit points covered; axe zero violations on room route.

---

## Phase T4 — Admin configuration

### T4.1 — Telehealth clinic & physician config in admin CMS

**Goal:** Non-technical staff can toggle telehealth on/off per clinic and set availability windows.

**Prompt:**
```
Add a "Telehealth" section to the admin CMS (/admin, editor/clinician/admin roles). It contains:

1. A Clinics subview: table of all clinics with columns: name, status badge, "Telehealth enabled"
   toggle switch (writes clinics.telehealth via Strapi), "Video window" text field
   (telehealthWindow), "Booking rule" bilingual input (telehealthRule SK+EN). Changes publish
   immediately to the live site (same ISR pattern as other content edits). Every change writes
   an audit_log entry.

2. A Physicians subview: table of physicians with a "Telehealth" toggle per row.

3. A Sessions overview: read-only table of all telehealth_sessions (today + next 7 days):
   date/time, clinic, physician, patient token (anonymised), status badge. Admin can manually
   cancel a session (POST /sessions/:id/cancel) with a required reason field.

Match the admin CMS visual vocabulary exactly (dark sidebar, schema-driven list/edit views,
bilingual inputs side by side). All changes are audited.
```
**Reference:** `admin.html`, `assets/admin.js`, `TELEMEDICINE_README.md §Admin config`
**Done when:** staff can toggle telehealth per clinic/physician; changes appear on the public telehealth page; sessions overview visible; manual cancel works; all changes audited.

---

## Phase T5 — Testing + launch

### T5.1 — E2E tests + telemedicine launch gate

**Goal:** Full automated test coverage; telemedicine added to the go/no-go gate.

**Prompt:**
```
Read TELEMEDICINE_E2E_TESTS.md and implement all SPEC TH-1 through TH-6 using the existing
Playwright + testing patterns from E2E_TEST_SPECS.md. Wire them into the CI suite so they run
after the main E2E suite and are also required green before a telemedicine launch.

Then update LAUNCH_CHECKLIST.md §L9 go/no-go gate to add:
  [ ] TH-Pilot: telehealth smoke-tested on FRO clinic in staging (one full session: book →
      device check → waiting room → admit → active call → end → post-call summary → HIS sync)
  [ ] TELEHEALTH_RECORDING_ENABLED=false verified in production config
  [ ] Telehealth pen-test items (TELEMEDICINE_ARCHITECTURE.md §Pen-test scope) closed
  [ ] Retention + consent compliance verified for video data
  [ ] Telehealth monitoring: session join rate, admission latency, post-call HIS sync DLQ added
      to L5 dashboards

Document the TH-Pilot soft-launch plan: enable telehealth for FRO only, monitor for 2 weeks,
then expand to all telehealth:true clinics.
```
**Reference:** `TELEMEDICINE_E2E_TESTS.md`, `LAUNCH_CHECKLIST.md §L9`
**Done when:** TH-1 through TH-6 green in CI; L9 gate updated; TH-Pilot plan documented; monitoring alerts added.

---

## Working tips specific to telemedicine
- **Video UI state is driven by `data-state` + `data-view` on `.room`** — CSS selectors do the heavy lifting; keep JS minimal and declarative.
- **Never store patient identity in `telehealth_sessions`** — only the opaque `patient_token`. Patient name/RČ is resolved at runtime from the eID OIDC context.
- **The HIS sync is the authoritative post-call record** — the `telehealth_summaries` table is a cache for fast portal display, not a system of record.
- **Test the LiveKit mock in CI** — set `TELEHEALTH_PROVIDER=mock`; never let CI talk to the real LiveKit instance.
- **Telehealth booking mode is an extension of the existing booking flow**, not a replacement. The `mode=telehealth` query parameter gates the UI; the server enforces clinic eligibility independently.
