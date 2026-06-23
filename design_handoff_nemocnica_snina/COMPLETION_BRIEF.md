# Completion Brief — Nemocnica Snina (production hardening → go-live)

**For:** Claude Code · **Status in:** 3 commits / 117 files complete (Phases 0–9 of `BUILD_GUIDE.md` scaffolded). This brief covers everything between "scaffold complete" and "live." Read `BUILD_GUIDE.md`, `PRODUCTION_ARCHITECTURE.md`, `DATA_MODEL.md`, and `CLAUDE.md` first. Work the workstreams in the order given — they're sequenced by dependency and launch-blocker weight.

**Decisions locked for this phase (no bracketed choices remain):**
- CMS: **Strapi** (Node/TS, self-hosted EU)
- API: **NestJS** (already built)
- Patient identity: **OIDC via Slovensko.sk eID** (national eID broker)
- HIS interop: **HL7 FHIR R4** (REST) where available, HL7 v2 fallback
- Hosting: **EU region**, TLS 1.3, AES-256 at rest

---

## Workstream A — Harden what's already built (do first; blocks sign-off)

### A1. Booking engine — server-side negative-path proof
**Goal:** Prove clinic rules are enforced at the API, not just the wizard UI. A forged request must be rejected.

**Prompt:**
```
Audit the booking API for server-side rule enforcement and add end-to-end (HTTP-level)
integration tests that POST directly to the booking endpoint, bypassing the wizard UI. Each of
these MUST return a 4xx with a clear error code and MUST NOT create a booking or lock a slot:
1.  Angiology booking on any weekday not in bookingDays [4,5] (e.g. a Wednesday).
2.  Angiology booking outside the 13:00–14:00 bookingWindow (e.g. 09:00 on a Friday).
3.  Trauma-surgery booking on a weekday not in [2,4] (e.g. Monday).
4.  Any booking for a clinic with status 'closed' (Diabetology) or 'alert' (Neurology).
5.  Any booking for a clinic with bookable:false.
6.  A booking for a clinic with referral:true submitted without referral confirmation.
7.  An invalid rodné číslo (fails modulo-11) — rejected before slot logic runs.
8.  Two concurrent requests for the same slot — exactly one succeeds (atomic lock), the other
    gets a conflict.
9.  A slot in the past.
10. A well-formed request with a tampered clinic/slot mismatch (slot belongs to another clinic).
Also assert the happy paths still pass. Put assertions on HTTP status + DB state (no orphan
booking, slot not locked). Report any rule found enforced only client-side and fix it server-side.
```
**Done when:** all 10 rejection tests pass at HTTP level; no rule is UI-only; happy paths green.

### A2. Audit log — immutability at the DB layer
**Goal:** Append-only in the database, not by convention. Decree 179/2020 is checked on this.

**Prompt:**
```
Make the audit_log table append-only at the database layer, not just in application code:
- Revoke UPDATE and DELETE on audit_log from the application DB role (grant INSERT + SELECT only).
- Add a BEFORE UPDATE/DELETE trigger that raises an exception, as defense in depth.
- Verify every booking, cancellation, onboarding decision, content change, and access to
  personal/health data writes an immutable entry (actor, action, entity, timestamp, request id).
- Add a test that attempts an UPDATE and a DELETE against audit_log under the app role and asserts
  both fail.
- Document the migration so a DBA can confirm the grants in production.
```
**Done when:** app role cannot mutate/delete audit rows (test proves it); coverage spans all sensitive actions.

### A3. GDPR data-subject rights (Art. 15 / 17)
**Goal:** Export + erasure tooling auditors will ask for.

**Prompt:**
```
Implement GDPR data-subject-rights tooling in the admin (admin role only, MFA-gated, every action
audited):
- Right of access (Art. 15): given a rodné číslo / patient identifier, export all personal data we
  hold on the web tier (bookings, onboarding applications, consents, SMS logs) as a structured
  file. Clinical records stay in HIS and are explicitly excluded with a note pointing to the HIS
  data controller.
- Right to erasure (Art. 17): delete/anonymize that person's web-tier data, preserving legally
  required records (e.g. financial/disclosure obligations) and writing an audit entry of what was
  erased and what was retained-with-reason.
Add a short RETENTION.md describing retention periods and the lawful basis for anything retained
through an erasure request. Add the DSAR + erasure items to LAUNCH_CHECKLIST.md.
```
**Done when:** an operator can export and erase a subject's web-tier data; retention rules documented; actions audited.

---

## Workstream B — Strapi CMS connection (highest feature priority)

**Why first among features:** until content comes from the CMS, staff can't edit the live site — the project's core requirement. Today the app reads `seed.ts`.

### B1. Stand up Strapi + content types from the data model
**Prompt:**
```
Stand up Strapi (self-hosted, EU, Postgres-backed) as the content layer. Create content types
matching DATA_MODEL.md exactly: departments, clinics, physicians, services, facilities, news,
disclosures (collections) and hospital, pages (singletons). Enable i18n with locales
sk, cs, pl, hu, uk, en. Use a media field for images and a file field for disclosure PDFs.
Preserve every field/enum/relationship — especially clinics.bookingDays (Mon=1…Sun=0),
bookingWindow, referral, status, bookable, and physicians.langs (and the physician→department/
clinic/facility relations). Import the full real content from assets/data.js (SEED) as initial
content. Configure RBAC roles editor / clinician / admin and require MFA for all Strapi accounts.
```
**Done when:** Strapi holds all collections in SK+EN with the real seed; roles + MFA enforced.

### B2. Repoint the app from seed.ts to Strapi
**Prompt:**
```
Replace the seed.ts data source with a typed Strapi client in the API/web data layer. Public
pages fetch published content from Strapi (REST or GraphQL) with ISR/edge caching and a short
revalidate window so admin edits appear quickly. The booking engine continues to read clinic
RULE fields from the same source of truth — confirm bookingDays/window/status/referral now come
from Strapi and the Workstream A1 tests still pass against live content. Keep seed.ts only as a
local-dev/test fixture. Decommission the prototype's custom /admin CRUD in favor of Strapi's admin
(or keep our /admin as a thin reskinned client of Strapi — your call, but only one editing surface
ships).
```
**Done when:** editing a clinic/department/news item in Strapi changes the live site; A1 tests pass against Strapi-sourced rules; one editing surface only.

---

## Workstream C — Identity + HIS (do together; they share the FHIR/identity surface)

### C1. eID / OIDC patient authentication
**Prompt:**
```
Replace the demo portal login with real patient authentication via OIDC against the Slovensko.sk
eID broker (national eID). Implement the full auth-code + PKCE flow, session management
(short-lived, httpOnly, secure), step-up 2FA for sensitive actions (lab-result PDF download),
and logout. Map the verified identity to the patient context used by the FHIR client. No patient
record is stored in our DB — identity only brokers access. Add a mock OIDC provider for local/CI
so tests don't depend on the live broker.
```
**Done when:** patient logs in via eID/OIDC; sessions secure; PDF download is step-up gated; CI uses a mock IdP.

### C2. HIS sync agent (consumer side of the queue)
**Prompt:**
```
Build the HIS sync agent that consumes the existing RabbitMQ events (booking.confirmed,
booking.cancelled, onboarding.accepted) and writes them to the Hospital Information System via
HL7 FHIR R4 (REST); support an HL7 v2 message fallback where FHIR isn't available. Requirements:
idempotent processing (use the existing idempotency keys), retry with backoff, dead-letter
handling, and reconciliation when HIS recovers from an outage so no booking is lost. For the
portal, implement the FHIR R4 read client (Condition, MedicationRequest, Observation, Appointment)
scoped to the authenticated patient. Log every HIS sync attempt and every patient-record access to
audit_log. Provide a HIS sandbox/mock for local + CI.
```
**Done when:** queued events reach HIS idempotently; outage → recovery loses nothing; portal reads live FHIR for the logged-in patient; all access audited.

---

## Workstream D — Payments (smaller surface)

### D1. PCI-compliant payment gateway
**Prompt:**
```
Integrate a PCI-compliant payment gateway for paid items: the LSPP €1.99 fee surfaced on clinics
like General Surgery, and paid medical certificates/documents. Card data never touches our servers
(hosted fields / redirect). Issue localized receipts, record transactions (no PAN), and handle
success/failure/refund webhooks idempotently. Localize checkout for all active locales. Audit
every transaction.
```
**Done when:** a paid item completes end-to-end with receipt; no card data on our servers; webhooks idempotent.

---

## Workstream E — Multilingual rollout (parallelizable; not an SK/EN launch blocker)

### E1. cs / pl / hu / uk via Google Cloud Translation
**Prompt:**
```
Activate locales cs, pl, hu, uk. Build the translation pipeline: Google Cloud Translation Advanced
(v3)/Adaptive with Custom Glossaries that lock brand, department, and clinical terminology
(seed the glossary from the SK/EN content). SK is the human-authored source; machine-translate the
other locales into Strapi draft entries; FLAG clinical and safety-critical pages (departments,
clinics, services, booking, onboarding, portal) for human review before publish. Cache translations
(Redis app-layer + CDN edge) to control cost. Verify hreflang now covers all six locales + x-default
and the sitemap lists every locale.
```
**Done when:** all 6 locales render; glossary terms preserved; clinical pages gated on human review; caching live; hreflang/sitemap complete.

---

## Workstream F — Pre-launch (last)

### F1. VAPT pen-test + go-live
**Prompt:**
```
Prepare for go-live once Workstreams A–C are merged:
- Commission an external VAPT pen-test; triage findings by severity and fix blockers.
- Run the full automated suite in CI (unit: RC + booking rules; integration: booking, onboarding,
  HIS queue resilience, audit immutability; E2E Playwright: booking, onboarding, portal across
  sk/en; axe a11y on every route). All green to proceed.
- Verify backups (3-2-1, EU geo-separate) with a test restore.
- Confirm monitoring/alerting on booking, queue depth/DLQ, HIS sync failures, and auth errors.
- Execute the soft-launch plan from LAUNCH_CHECKLIST.md: enable booking for FRO only, monitor,
  then full launch. Keep a documented rollback.
Update LAUNCH_CHECKLIST.md with results and produce a final go/no-go summary.
```
**Done when:** pen-test blockers cleared; CI fully green; restore verified; soft-launch → full launch executed with rollback ready.

---

## Sequencing summary
1. **A (A1→A2→A3)** — harden + close the GDPR gap; unblocks sign-off.
2. **B (B1→B2)** — Strapi connection; makes the CMS real (core requirement).
3. **C (C1+C2)** — eID auth + HIS agent together; makes portal + bookings real.
4. **D** — payments.
5. **E** — cs/pl/hu/uk (can run in parallel from any point after B).
6. **F** — pen-test + go-live, last.

## Definition of done (whole product)
- Staff edit all content in Strapi (SK+EN min) → live site updates; RBAC + MFA enforced.
- Booking rules enforced **server-side** (A1 proven); slots atomic; RČ validated.
- Audit log **immutable at DB layer**; covers all sensitive actions.
- GDPR: consent + minimization + **DSAR/erasure tooling** + retention policy.
- Patient portal behind **eID/OIDC + 2FA**; records via **FHIR**; no patient data in our DB.
- Bookings/onboarding reach **HIS via queue**, idempotent + outage-safe; eDohoda XML on accept.
- Payments PCI-compliant; APS feed live with fallback.
- WCAG 2.1 AA on all routes; 6 locales with glossary-locked clinical terms (clinical pages human-reviewed).
- Pen-test cleared; backups restore-tested; soft-launch (FRO) → full launch with rollback.
```
