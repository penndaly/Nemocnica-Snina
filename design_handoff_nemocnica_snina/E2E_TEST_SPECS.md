# E2E Test Specs (Playwright) — Nemocnica Snina

Concrete, hand-to-Claude-Code specifications for the end-to-end suite. These describe **flows, selectors, fixtures, and assertions** so the developer can implement them without guessing. They cover the launch-critical journeys: **booking, onboarding, patient portal**, plus i18n, accessibility, and admin smoke. Run across `sk` + `en`.

> Pair these with the API-level negative-path tests in `COMPLETION_BRIEF.md` A1 — Playwright covers the user journey; A1 covers forged-request rejection. Both are required.

## Conventions
- **Framework:** `@playwright/test`. Folder: `apps/web/e2e/`. Config: 2 projects (`sk`, `en`) via `baseURL` + `DEFAULT_LOCALE`, plus a mobile viewport project (`iPhone 13`).
- **Test data:** seed the DB from the same `assets/data.js` content before the run (global setup). Mock external services: `OIDC_MOCK_ENABLED=true`, `HIS_MOCK_ENABLED=true`, `SMS_PROVIDER=console` (read OTP from a `/__test__/last-otp` test-only endpoint guarded by `NODE_ENV!=='production'`).
- **Selectors:** add stable `data-testid` attributes during the build (listed per spec). Prefer role/label queries where possible for a11y coverage.
- **Time:** freeze "now" to a fixed Monday (e.g. `2026-06-08`) via a test clock so weekday rules are deterministic.
- **Isolation:** each test resets booking/onboarding tables in `beforeEach`; content (CMS) stays read-only.

---

## SPEC 1 — Booking: happy path (Urology, accepts new patients)
**File:** `e2e/booking-happy.spec.ts`
**Steps & assertions:**
1. Visit `/sk/objednanie`. Stepper shows 5 steps; step 1 "Ambulancia" active.
2. Only `bookable:true` clinics are listed (assert Diabetology and Neurology are **absent**; Urology present).
3. Click Urology (`data-testid="clinic-option-urologicka"`). Step advances to Date.
4. The date grid shows **only weekdays in `bookingDays [1–5]`** — assert no Saturday/Sunday cells. Pick the first date.
5. Time step shows a slot grid; pick the first slot. Capture chosen date+time.
6. Details: fill name, **valid RČ** `850315/1234`, phone, insurer. Tick GDPR consent. (No referral checkbox for Urology.)
7. Submit → Confirm step shows a booking ID matching `/^NS-/` (or prod format) and the chosen clinic/date/time/location.
8. Assert a booking row exists in DB for that slot and the slot is now locked.

## SPEC 2 — Booking: referral-gated clinic (Angiology, Thu/Fri 13:00–14:00, referral required)
**File:** `e2e/booking-angiology.spec.ts`
1. Deep-link `/sk/objednanie?clinic=angiologicka` → lands on step 2 with the Angiology banner + booking-rule callout visible.
2. Date grid shows **only Thursdays/Fridays** (`bookingDays [4,5]`); assert a Monday is not present.
3. Pick a Thursday. Time step offers **only slots inside 13:00–14:00**; assert no 09:00 slot.
4. Details step renders the **referral consent checkbox** (`data-testid="consent-referral"`) in addition to GDPR.
5. Submitting with referral **unchecked** → blocked (validation message, no advance).
6. Check both consents → submit → confirmation. Booking persisted.

## SPEC 3 — Booking: invalid RČ rejected in UI
**File:** `e2e/booking-rc.spec.ts`
1. Walk to the details step for any clinic. Enter RČ `850315/9999` (fails modulo-11).
2. On blur/submit, assert a field-level error and no advance to Confirm. Then correct to `850315/1234` and confirm it proceeds.

## SPEC 4 — Booking: closed/temporary clinics are not bookable
**File:** `e2e/booking-unavailable.spec.ts`
1. On `/sk/ambulancie`, the Diabetology (`closed`) and Neurology (`alert`) cards show the disabled "Online booking unavailable" button (`data-testid="book-disabled-diabetologicka"`), not a link.
2. Direct-navigating `/sk/objednanie?clinic=diabetologicka` does **not** present a bookable flow (redirect or blocked-state message). Assert no slot grid renders.

## SPEC 5 — New-patient onboarding (eDohody) end-to-end
**File:** `e2e/onboarding.spec.ts`
**Patient side:**
1. Visit `/sk/registracia`. Physician selector lists **only accepting** physicians (assert an `accepting:false` doctor like Kulan is absent; Nebesník present).
2. Select Nebesník, fill patient details with valid RČ + insurer, submit → success acknowledgement with an application reference.
3. Assert an `onboarding_application` row exists with status `pending`.

**Staff side (admin, clinician role):**
4. Log into `/admin` via the MFA test helper (seed a clinician with a known TOTP secret; generate the code in-test).
5. Open the onboarding review queue; the new application appears.
6. Click Accept in the modal → status becomes `accepted`; assert an **eDohoda XML** artifact is generated containing the patient RČ, insurer code, and doctor code (fetch via a test endpoint or assert the stored document).
7. Assert an audit_log entry records the decision (actor = clinician).

## SPEC 6 — Patient portal (mock eID + 2FA gate)
**File:** `e2e/portal.spec.ts`
1. Visit `/sk/portal` → redirected into the **mock OIDC** flow; complete it as a seeded test patient; land back on the dashboard.
2. Dashboard shows the four sections (Overview / Records / Prescriptions / Labs). Records list FHIR-sourced demo Conditions; Labs show the lipid panel flagged "high".
3. Click a lab-result **PDF download** → **step-up 2FA** is required (assert the challenge appears); complete it via the test helper → download starts (assert response 200 + `application/pdf`).
4. Trigger a prescription **refill request** → confirmation toast; assert a queued message/record.
5. Log out → revisiting `/sk/portal` requires auth again.

## SPEC 7 — i18n & language switch
**File:** `e2e/i18n.spec.ts`
1. On `/sk`, assert `<html lang="sk">` and a known SK string in the hero. Switch to EN → URL becomes `/en`, `<html lang="en">`, hero shows the EN string.
2. Assert the page head contains reciprocal `hreflang` alternates for all six locales + `x-default`.
3. Run SPEC 1's booking happy path again under the `en` project to prove the flow works in English.

## SPEC 8 — Accessibility (axe) on key routes
**File:** `e2e/a11y.spec.ts`
1. Using `@axe-core/playwright`, scan `/sk`, `/sk/oddelenia`, `/sk/ambulancie`, `/sk/lekari`, `/sk/objednanie` (each step), `/sk/registracia`, `/sk/portal`, `/sk/kontakt`. Assert **zero serious/critical violations**.
2. Keyboard-only pass on the booking wizard: Tab to every control, complete a booking using only keyboard; assert visible focus throughout.
3. Toggle high-contrast and 130% text-resize from the utility bar; assert the class/localStorage applies and layout doesn't break (no clipped controls).

## SPEC 9 — Admin CMS smoke (edit → reflected on site)
**File:** `e2e/admin-cms.spec.ts`
1. Log into `/admin` (admin role + MFA helper).
2. Edit a department's SK + EN summary (side-by-side fields); save → success toast.
3. Visit the public department page in both locales; assert the new text appears (allow for the ISR revalidate window).
4. Assert RBAC: a seeded `editor` cannot reach the onboarding review queue (route blocked).
5. Assert the edit wrote an audit_log entry.

---

## Implementation prompt (paste to Claude Code)
```
Implement the Playwright E2E suite in apps/web/e2e/ exactly per
design_handoff_nemocnica_snina/E2E_TEST_SPECS.md (SPEC 1–9). Configure projects for sk, en, and a
mobile viewport. Add a global setup that seeds the DB from assets/data.js and a global teardown.
Add the test-only helpers the specs require, all guarded by NODE_ENV!=='production': a TOTP code
generator for seeded staff, a /__test__/last-otp endpoint for SMS OTP, a mock OIDC login for the
patient portal, and a fixed test clock (now = 2026-06-08). Add the data-testid attributes named in
the specs to the relevant components as you go. Wire the suite into CI after the unit/integration
stage; it must be green to proceed to launch. Use @axe-core/playwright for SPEC 8. Report any spec
that revealed a real bug and the fix.
```

## Coverage map (specs → requirements)
| Requirement | Spec(s) |
|---|---|
| Clinic booking rules (weekday/window/referral/status) enforced in UX | 1, 2, 4 |
| RČ modulo-11 validation | 1, 3 |
| Slot persistence/lock | 1, 2 |
| eDohody onboarding + staff review + NCZI XML + audit | 5 |
| Patient portal, eID, 2FA-gated PDF, FHIR, refill | 6 |
| 6-locale i18n + hreflang + EN parity | 7 |
| WCAG 2.1 AA + keyboard + high-contrast/text-resize | 8 |
| CMS edit → live site + RBAC + audit | 9 |
