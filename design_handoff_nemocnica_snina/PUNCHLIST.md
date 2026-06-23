# Go-Live Punch List — Nemocnica Snina (single executable brief)

**For:** Claude Code · **Picks up from:** commit `1525cbb` (74 files). This is the **final functional/compliance stretch** before go-live. It is written as one brief you can execute top to bottom. Read `COMPLETION_BRIEF.md`, `CONFIG_AND_ENV.md`, `DATA_MODEL.md`, and `CLAUDE.md` first.

**Decisions (locked, no blanks):** Strapi CMS · NestJS API · Slovensko.sk eID OIDC · HL7 FHIR R4 (HL7 v2 fallback) · EU hosting · TLS everywhere · MFA for staff.

---

## How to run this brief
Execute the **7 tasks in order** — they're sequenced by dependency. Do **one task per turn**, commit after each, and confirm its **Done-when** before moving on. (Working one task per turn also keeps each request small and avoids the 1M-context trigger.)

**Driver prompt (paste once to begin):**
```
Read design_handoff_nemocnica_snina/PUNCHLIST.md in full, plus COMPLETION_BRIEF.md and
CONFIG_AND_ENV.md. Execute Task 1 ONLY, then stop and report what you changed and how its
Done-when is satisfied. After I confirm, I'll tell you to proceed to Task 2. Do not skip ahead.
Keep external services in mock mode (OIDC_MOCK_ENABLED, HIS_MOCK_ENABLED, SMS_PROVIDER=console).
```
Then for each subsequent task: `Proceed to Task N from PUNCHLIST.md. One task, then stop and report.`

**Order & why:**
1. Audit-log immutability — compliance gate, touches the DB role everything else writes through.
2. Finish Strapi repoint (7 collections) — makes content + booking rules read from the real source.
3. Booking negative-path tests — must run against the live (Strapi-sourced) rules from Task 2.
4. HIS sync agent + FHIR read client — makes bookings real + portal data real.
5. Step-up 2FA on lab-result PDF — small, depends on the portal/FHIR path from Task 4.
6. GDPR DSAR / erasure tooling — spans all the data the prior tasks finalized.
7. Clinical-content human-review gate — last; governs publishing the machine translations.

---

## Task 1 — Audit-log immutability at the DB layer
**Why:** Decree 179/2020 requires tamper-evident audit. "We don't call update" is not enough.
```
Make audit_log append-only at the DATABASE layer, not just in app code:
- Grant the application runtime DB role INSERT + SELECT only on audit_log; REVOKE UPDATE and DELETE.
  Use DATABASE_MIGRATION_URL (separate migrator role) for schema changes, per CONFIG_AND_ENV.md.
- Add a BEFORE UPDATE OR DELETE trigger on audit_log that raises an exception (defense in depth).
- Verify every booking, cancellation, onboarding decision, content change, payment, and any access
  to personal/health data writes an immutable entry (actor, role, action, entity, timestamp,
  request id).
- Add an automated test that attempts UPDATE and DELETE on audit_log under the app role and asserts
  BOTH fail. Document the grants in a migration comment for the DBA.
```
**Done when:** app role cannot mutate or delete audit rows (test proves it); all sensitive actions write entries; migrator role still manages schema.

## Task 2 — Finish the Strapi repoint (all 7 collections)
**Why:** Singletons are wired; the collections and — critically — the booking rules must come from the CMS, not `seed.ts`.
```
Repoint the public site and API from seed.ts to the Strapi client for ALL collections:
departments, clinics, physicians, services, facilities, news, disclosures. Public pages fetch
published content with ISR (CONTENT_REVALIDATE_SECONDS). CRITICAL: the booking engine must read
clinic RULE fields (bookingDays, bookingWindow, status, bookable, referral) from Strapi as the
single source of truth — not seed.ts. Keep seed.ts only as a local/CI fixture. Ensure exactly one
editing surface ships (Strapi admin; retire the prototype's custom CRUD or make it a thin Strapi
client). After repointing, confirm the existing atomic-slot/double-booking logic still passes
against Strapi-sourced clinics.
```
**Done when:** editing a clinic/department/news item in Strapi changes the live site; booking rules demonstrably read from Strapi; one editing surface; double-booking test still green.

## Task 3 — Booking negative-path tests (the other 9)
**Why:** Only double-booking is proven. Rules must reject **forged API requests**, against live content.
```
Add end-to-end HTTP-level tests that POST directly to the booking endpoint (bypassing the wizard),
using Strapi-sourced clinic rules. Each MUST return 4xx and MUST NOT create a booking or lock a
slot:
1. Angiology on a weekday not in [4,5] (e.g. Wednesday).
2. Angiology outside the 13:00–14:00 window (e.g. 09:00 Friday).
3. Trauma surgery on a weekday not in [2,4] (e.g. Monday).
4. Any booking for status 'closed' (Diabetology) or 'alert' (Neurology).
5. Any booking for bookable:false.
6. referral:true clinic submitted without referral confirmation.
7. Invalid rodné číslo (fails modulo-11), rejected before slot logic.
8. Concurrent same-slot requests — exactly one succeeds (already implemented; assert here).
9. A slot in the past.
10. Tampered clinic/slot mismatch (slot belongs to another clinic).
Assert HTTP status AND DB state (no orphan booking, slot not locked). Fix any rule found enforced
only client-side. Keep the happy paths green.
```
**Done when:** all 10 rejection tests pass at HTTP level against live rules; no UI-only rule remains.

## Task 4 — HIS sync agent + FHIR read client
**Why:** Bookings aren't real in the HIS and the portal shows demo data until this lands. Biggest remaining feature.
```
Build the HIS sync agent that CONSUMES the existing RabbitMQ events (booking.confirmed,
booking.cancelled, onboarding.accepted) and writes them to the HIS via HL7 FHIR R4 (REST), with an
HL7 v2 fallback. Requirements: idempotent processing (use existing idempotency keys), retry with
backoff, dead-letter handling, and reconciliation after an HIS outage so no booking is lost. Then
implement the FHIR R4 READ client for the portal — Condition, MedicationRequest, Observation,
Appointment — scoped to the authenticated patient, replacing the demo data. Log every sync attempt
and every patient-record access to audit_log. Use HIS_MOCK_ENABLED for local/CI.
```
**Done when:** queued events reach HIS idempotently; outage→recovery loses nothing; portal reads live FHIR for the logged-in patient; all access audited.

## Task 5 — Step-up 2FA on lab-result PDF
**Why:** Health-record download needs more than session login.
```
Gate the lab-result PDF download behind a step-up 2FA challenge (re-verify beyond the eID session)
in the patient portal. The challenge must appear before the file streams; on success return the
PDF (application/pdf). Audit each download (patient, document, timestamp). Add a test asserting the
download is blocked without the step-up and succeeds with it.
```
**Done when:** PDF download requires step-up 2FA; test proves blocked-without / allowed-with; downloads audited.

## Task 6 — GDPR data-subject rights (Art. 15 / 17)
**Why:** Export + erasure tooling auditors will request.
```
Implement GDPR data-subject-rights tooling in the admin (admin role only, MFA-gated, fully
audited):
- Access (Art. 15): given a rodné číslo/identifier, export all web-tier personal data (bookings,
  onboarding applications, consents, SMS logs, payments) as a structured file. Exclude clinical
  records held in HIS, with a note naming the HIS controller.
- Erasure (Art. 17): delete/anonymize that person's web-tier data, preserving legally required
  records (financial/disclosure) and writing an audit entry of what was erased vs retained-with-
  reason.
Add RETENTION.md (retention periods + lawful basis) and add both items to LAUNCH_CHECKLIST.md.
```
**Done when:** operator can export and erase a subject's web-tier data; retention documented; actions audited.

## Task 7 — Clinical-content human-review gate
**Why:** Machine-translated clinical text must not auto-publish.
```
For content collections (departments, clinics, services, news) in Strapi, ensure cs/pl/hu/uk
translations enter as DRAFTS and require human review/approval before publish — never auto-publish
machine-translated clinical or safety-critical content. Wire scripts/translate-messages.ts (or its
content equivalent) to use the Google Cloud Translation v3 glossary (TRANSLATION_GLOSSARY_ID) so
brand/department/clinical terms are locked. Add a clear "needs review" state in the Strapi editor
for these locales. SK remains the human-authored source; EN is already human-authored.
```
**Done when:** machine-translated clinical content lands as draft + needs-review; glossary terms preserved; publish requires human approval.

---

## Definition of done (this brief)
- Audit log immutable at DB layer; covers all sensitive actions.
- All content + **booking rules** read from Strapi; one editing surface; CMS edits go live.
- All 10 booking negative paths rejected server-side against live rules.
- Bookings/onboarding reach HIS via queue (idempotent, outage-safe); portal reads live FHIR.
- Lab-result PDF behind step-up 2FA; downloads audited.
- GDPR DSAR + erasure tooling live; retention documented.
- Clinical machine-translations gated on human review with glossary-locked terms.

**After this brief:** only external wiring remains — real credentials (`CONFIG_AND_ENV.md`), `pnpm install` + `docker-compose up`, VAPT pen-test, backup restore test, and hospital staff content review — then the soft-launch (FRO first) → full launch from `LAUNCH_CHECKLIST.md`.
