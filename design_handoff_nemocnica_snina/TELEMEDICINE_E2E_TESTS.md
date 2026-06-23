# Telemedicine E2E Test Specs — Nemocnica Snina

Extends `E2E_TEST_SPECS.md`. All testing conventions from that document apply: Playwright, locale-aware helpers, test clock at a fixed date, mock IdP, mock video provider. Run these specs in CI after the main SPEC 1–9 suite; they must be green before any telemedicine deployment.

---

## SPEC TH-1 — Telehealth booking wizard (patient)

**Tags:** `@telehealth @booking @patient`

```
Given the patient is authenticated via the mock eID IdP
When they navigate to /sk/objednanie?mode=telehealth

STEP 1 — Clinic selection
Then only clinics with telehealth:true are shown
And each card has a "Video konzultácia" chip
And clinics with telehealth:false are absent

STEP 2 — Date selection
When they select a telehealth-enabled clinic
Then the date picker shows only dates within telehealthWindow (if set)
And each selected date card shows a "Video" chip

STEP 3 — Time slot
When they select a valid date
Then time slots are labelled "Video konzultácia"

STEP 4 — Patient details
Then the standard patient form is shown
And a camera/mic device-check callout is visible
And a "Telehealth GDPR consent" checkbox is present and unchecked
When they attempt to submit without checking the telehealth consent
Then the form does not submit and an error is shown on that checkbox
When they check the telehealth consent and complete the form
Then submission succeeds

STEP 5 — Confirmation
Then a booking ID is shown
And a "Join consultation" button is shown but disabled
And the label "Active 10 minutes before your appointment" is visible
And the telehealth consent record exists in booking_consents with consent_type='telehealth_medical_record'
And a telehealth_sessions row exists with status='scheduled'

Done when: test passes for SK locale; also run for EN locale.
```

---

## SPEC TH-2 — Session join: patient waiting room

**Tags:** `@telehealth @room @patient`

```
Given a telehealth_sessions row with status='scheduled' for today
And the patient is authenticated
When they navigate to /sk/telehealth/konzultacia/:sessionId
Then the pre-call device check runs (mock: permissions granted)
And the waiting room overlay is shown
And the session status indicator shows amber pulsing dot
And the appointment card shows the clinic name and time
And the controls bar is disabled (pointer-events:none)

When the patient's eID session is absent (unauthenticated)
Then they are redirected to /sk/portal with a login prompt

When the session status is 'cancelled'
Then a terminal state card is shown with the clinic phone number
And no join token is issued (GET /sessions/:id/join returns 403)

Done when: waiting room renders; auth guard works; cancelled session shows terminal state.
```

---

## SPEC TH-3 — Session: physician admits → active call

**Tags:** `@telehealth @room @physician`

```
Given a telehealth_sessions row with status='waiting' (patient is in the waiting room)
And the physician is authenticated (staff OIDC + MFA)
When the physician navigates to /sk/telehealth/konzultacia/:sessionId?role=physician
Then the doctor view is shown (patient in main tile, self PiP, side panel visible)
And the side panel shows the telehealth_intake data (reason, medications, symptoms)
And an "Admit patient" button is visible in the waiting room state

When the physician clicks "Admit patient"
Then POST /telehealth/sessions/:id/admit is called
And the session status transitions to 'active'
And both the patient room and the physician room show the "active" state
And the elapsed timer starts
And an audit_log entry is written: { action: 'telehealth.session.admitted' }

When the physician ends the call
Then POST /telehealth/sessions/:id/end is called
And the session status transitions to 'ended'
And the telehealth.session.ended event is published to RabbitMQ
And both rooms show the post-call overlay

Done when: admit flow works; status transitions are reflected in both rooms; audit logged.
```

---

## SPEC TH-4 — Post-call summary + HIS sync

**Tags:** `@telehealth @his @summary`

```
Given a telehealth_sessions row with status='ended'
And telehealth_summaries row exists with prescription_issued=true and a follow_up_recommendation

PATIENT SIDE:
When the patient views the post-call overlay
Then the consultation summary items are shown (clinical note badge, e-prescription badge, follow-up badge)
And "View in portal" links to the portal teleconsultations section
And "Book follow-up" links to /objednanie

PORTAL — PAST TAB:
When the patient navigates to /sk/portal and clicks "Teleconsultations → Past"
Then the ended session is listed with date, physician, duration chip
When they click "View summary"
Then the summary items expand inline
When they click "Download summary PDF"
Then step-up 2FA is triggered (re-authenticate)
And on success, the PDF download begins
And an audit_log entry is written: { action: 'telehealth.summary.pdf.downloaded' }

HIS SYNC:
When the telehealth.session.ended event is consumed by the HIS sync agent
Then a FHIR Encounter (status=finished, class=VR) is written to the HIS sandbox
And if prescription_issued=true, a FHIR MedicationRequest is also written
And telehealth_sessions.his_synced is set to true
And telehealth_summaries.his_encounter_id is set

IDEMPOTENCY:
When the same event is replayed
Then no duplicate FHIR resources are created
And his_synced remains true

Done when: patient sees summary; PDF download is step-up gated; FHIR Encounter written; idempotent replay proven.
```

---

## SPEC TH-5 — Security: token and session isolation

**Tags:** `@telehealth @security`

```
TOKEN ISOLATION:
Given patient A has a valid join token for session S1
When patient A attempts GET /telehealth/sessions/:S2/join (a different session)
Then the response is 403

When an unauthenticated request is sent to GET /telehealth/sessions/:id/join
Then the response is 401

TOKEN EXPIRY:
Given a join token issued more than TELEHEALTH_SESSION_TTL_SECONDS ago
When the token is used to connect to the LiveKit room (mock)
Then the connection is rejected

ADMISSION GATE:
When a patient sends POST /telehealth/sessions/:id/admit (physician-only endpoint)
Then the response is 403 (insufficient role)

RECORDING FLAG:
Given TELEHEALTH_RECORDING_ENABLED=false (default)
When the API receives a request to start recording
Then it returns 403 with reason 'recording_disabled'

CONSENT GATE:
Given a telehealth booking without telehealth_medical_record consent
When the patient sends POST /telehealth/sessions/:id/join
Then the response is 403 with reason 'consent_required'

Done when: all isolation checks pass at HTTP level; recording block enforced.
```

---

## SPEC TH-6 — Admin telehealth config

**Tags:** `@telehealth @admin`

```
Given an admin user is logged in to /admin (with MFA)

CLINIC TOGGLE:
When they navigate to Admin → Telehealth → Clinics
Then the clinic list shows all clinics with a "Telehealth enabled" toggle
When they toggle telehealth:true on a previously-disabled clinic
Then the clinic's telehealth field is updated in Strapi
And the public /sk/telehealth page's eligible-clinics grid updates within CONTENT_REVALIDATE_SECONDS
And an audit_log entry is written

PHYSICIAN TOGGLE:
When they toggle telehealth:true on a physician
Then the physician's telehealth field is updated in Strapi
And an audit_log entry is written

SESSION MANAGEMENT:
When they view Admin → Telehealth → Sessions
Then today's and upcoming sessions are listed with anonymised patient tokens
When they cancel a session with a reason
Then POST /sessions/:id/cancel is called
And the session status becomes 'cancelled'
And the patient receives a cancellation SMS
And an audit_log entry is written

EDITOR ROLE:
When a staff user with role=editor navigates to Admin → Telehealth → Sessions
Then the sessions view is not accessible (403 or hidden from nav)

Done when: clinic + physician toggles work and propagate to the public site; session cancel with SMS; editor role blocked from sessions view.
```

---

## Accessibility checks (add to existing axe suite)

Add these routes to the axe/Playwright a11y pass (SPEC 4 in `E2E_TEST_SPECS.md`):

| Route | State to check | Expected result |
|---|---|---|
| `/sk/telehealth` | default | zero axe critical/serious |
| `/sk/telehealth/konzultacia/:id` | waiting state | zero axe critical/serious; all controls have `aria-label` |
| `/sk/telehealth/konzultacia/:id` | active state | zero axe; `aria-pressed` on mic/cam toggles; `aria-live` region present |
| `/sk/telehealth/konzultacia/:id` | postcall state | zero axe; focus on primary action button |

Keyboard-only pass:
- Tab through all controls in active state; Space/Enter activates each.
- Escape key opens end-call confirmation dialog; Enter/Space confirms.
- Focus trapped in confirmation dialog until dismissed.
