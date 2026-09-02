# Launch Checklist — Nemocnica Snina (external wiring → go-live)

**For:** Ops + Claude Code · **Picks up from:** commit `b4a46fe` (30 files, 1551 insertions) — `PUNCHLIST.md` complete, all 7 tasks merged, "Definition of done (this brief)" satisfied. This is the **final brief on the roadmap** — everything between "feature- and compliance-complete in mock mode" and "live for patients." No feature work remains; this brief is **wiring real credentials, proving the system on real infrastructure, and executing a controlled launch**. Read `CONFIG_AND_ENV.md`, `E2E_TEST_SPECS.md`, the tail of `PUNCHLIST.md`, and `COMPLETION_BRIEF.md` §F1 first.

**Decisions (locked, carried forward):** Strapi CMS · NestJS API · Slovensko.sk eID OIDC · HL7 FHIR R4 (HL7 v2 fallback) · RabbitMQ HIS queue · EU hosting (`europe-central2` / `europe-west3`) · TLS 1.3 · AES-256 at rest · MFA for staff · GP webpay / Stripe-EU payments · Google Cloud Translation v3 + glossary.

**Soft-launch decision (locked):** booking enabled for **FRO (Fyziatricko-rehabilitačné oddelenie / one pilot clinic) only** first, monitor, then full launch. A documented rollback is mandatory at every stage.

---

## How to run this brief
This brief has **two owners**. **Ops tasks (L1, L4, L5, L6)** provision accounts, infra, backups, monitoring, and the pen-test. **Build tasks (L2, L3, L7, L8)** are paste-ready for Claude Code, one per turn, commit after each, confirm the **Done-when** before moving on. **L9 is the joint go/no-go gate and launch** — neither owner runs it alone.

Execute the **9 items in order** — they're sequenced by dependency: you can't smoke-test integrations (L2) before secrets are injected (L1); you can't run the live CI suite (L3) before staging is up (L2); you don't pen-test (L6) a system that isn't green (L3); you don't launch (L9) until backups (L4), monitoring (L5), pen-test (L6), and content (L7) are all signed off.

**Driver prompt (paste once to begin the build tasks):**
```
Read design_handoff_nemocnica_snina/LAUNCH_CHECKLIST.md in full, plus CONFIG_AND_ENV.md and
E2E_TEST_SPECS.md. Execute the next unblocked BUILD task (L2, L3, L7, or L8) ONLY, then stop and
report what you changed and how its Done-when is satisfied. Do not start an OPS task (L1/L4/L5/L6)
or the launch gate (L9) — those are run by ops/jointly. Do not skip ahead.
```

**Order & why:**
1. **L1 — Provision accounts + inject real secrets, kill mocks.** Everything downstream runs against real vendors; until this lands the system is still in sandbox.
2. **L2 — Stand up EU staging + integration smoke.** First contact with real eID/HIS/SMS/payment/translation endpoints; flushes credential/redirect/allowlist errors early.
3. **L3 — Full CI suite green on staging.** Re-run every test against live-wired services before anyone trusts the system.
4. **L4 — Backup + disaster-recovery restore test.** Prove data is recoverable before it holds real patient bookings.
5. **L5 — Monitoring, alerting, on-call.** You must be able to *see* the soft-launch.
6. **L6 — External VAPT pen-test + triage.** Independent security sign-off on a green, monitored, real-infra system.
7. **L7 — Hospital staff content review + real media.** Human sign-off on clinical copy, translations, images, disclosure PDFs.
8. **L8 — Launch records: DSAR/erasure runbook, RETENTION.md, legal text live.** Close the GDPR items `COMPLETION_BRIEF` A3 / `PUNCHLIST` Task 6 told us to record here.
9. **L9 — Go/No-go gate → soft-launch (FRO) → full launch, with rollback.** The controlled cutover.

---

## L1 — Provision real accounts & inject secrets (OPS)
**Why:** Every prompt in the build is parameterized — `CONFIG_AND_ENV.md` leaves "no blanks, only real credentials to be filled by ops." This is where they get filled.
```
Work the "Accounts to provision" table in CONFIG_AND_ENV.md end to end (all 14 rows): EU cloud
(CMEK on), managed Postgres/Redis/RabbitMQ (TLS, DLQ), Strapi host, Slovensko.sk eID OIDC client
(client_id/secret + redirect allowlist), HIS FHIR/HL7 creds (sandbox first), NCZI eObjednanie/
eDohody, e-VÚC/PSK APS key, SMS gateway (sender ID registered), payment gateway, Google Cloud
Translation service account + glossary bucket, error monitoring/uptime. Drop every 🔴 secret into
the secret manager — NEVER the repo. Then set the production env from .env.example with NO CHANGEME
left:
- OIDC_MOCK_ENABLED=false · HIS_MOCK_ENABLED=false · SMS_PROVIDER=<real vendor> · MFA_REQUIRED=true
- DATABASE_URL/REDIS_URL/RABBITMQ_URL on TLS schemes (rediss:// / amqps://)
- App runtime DB role has INSERT+SELECT only on audit_log; schema changes use DATABASE_MIGRATION_URL.
  Run `make db-harden` against the production DB to apply the REVOKE + BEFORE UPDATE/DELETE trigger
  (already authored), then confirm the grants under the app role.
- GOOGLE_APPLICATION_CREDENTIALS mounted at runtime; secrets/ in .gitignore
Run the startup config validator (CONFIG_AND_ENV.md "Config validation"): it MUST fail fast if any
required var is missing and MUST assert the production invariants (mocks off, MFA on, TLS schemes,
no CHANGEME placeholder). Generate CONFIG.md from the validated set.
```
**Done when:** all 14 vendor accounts exist with EU residency; every 🔴 secret is in the vault; the config validator passes in `NODE_ENV=production` with mocks off, MFA on, TLS everywhere, and zero placeholders.

## L2 — Stand up EU staging + integration smoke (BUILD)
**Why:** First real handshake with eID, HIS, SMS, payments, NCZI, APS, and Translation. Find broken redirects/allowlists/scopes here, not during launch.
```
Bring up a staging environment on the real EU infrastructure from L1 (pnpm install +
docker-compose up locally to confirm the stack, then deploy to EU staging). Run the production
build, apply migrations via DATABASE_MIGRATION_URL, seed CMS content from Strapi (NOT seed.ts), and
execute a smoke pass against each integration in sandbox/test mode:
- eID/OIDC: complete an auth-code+PKCE login against the broker SANDBOX; confirm redirect URI is
  allowlisted and the session is short-lived/httpOnly/secure.
- HIS: publish one booking.confirmed to RabbitMQ; confirm the sync agent writes it via FHIR R4 to
  the HIS sandbox idempotently; confirm the portal FHIR read returns the seeded test patient.
- SMS: send one OTP through the real gateway (test number); confirm sender ID and delivery.
- Payments: run one hosted-fields/redirect test charge for the LSPP €1.99 item; confirm webhook
  signature verification and receipt; assert no PAN touches our servers.
- NCZI/APS: confirm the eDohoda XML endpoint accepts a test document and the e-VÚC APS feed renders
  live with the CMS fallback when the feed is forced to fail.
- Translation: machine-translate one news item into cs/pl/hu/uk as Strapi DRAFTS with glossary
  terms preserved.
Report every credential/scope/allowlist issue found and fixed. Do not point staging at any
production HIS or real patient data.
```
**Done when:** staging is live on EU infra; each integration completes its smoke step against sandbox/test endpoints; the APS fallback is proven; no integration is still running on a mock.

## L3 — Full automated suite green on staging (BUILD)
**Why:** `COMPLETION_BRIEF` §F1: "Run the full automated suite in CI… All green to proceed." Re-run everything against the live-wired (not mocked) services.
```
Run the COMPLETE test suite in CI against the staging build and make it green:
- Unit: rodné číslo modulo-11 + every booking rule (bookingDays/window/status/referral/bookable).
- Integration (HTTP-level): the 10 booking negative-path rejections (PUNCHLIST Task 3 /
  COMPLETION_BRIEF A1) against STRAPI-SOURCED clinic rules; audit_log immutability (UPDATE+DELETE
  under the app role both fail); HIS queue resilience (idempotent replay + outage→reconcile, no lost
  booking); DSAR export + erasure tooling.
- E2E (Playwright, E2E_TEST_SPECS.md SPEC 1–9) across the sk + en projects + mobile viewport, using
  the test-only helpers (mock IdP/TOTP/last-otp/test clock at 2026-06-08) on the CI lane only.
- a11y: @axe-core/playwright on every key route — zero serious/critical violations; keyboard-only
  booking pass; high-contrast + 130% text-resize don't break layout.
Wire the suite as a launch gate: E2E runs after unit/integration and must be green to proceed. Fix
any rule found enforced only client-side. Report the final pass matrix (suite × sk/en).
```
**Done when:** unit + integration + E2E (sk/en/mobile) + axe all green in CI against the staging (Strapi-sourced, live-wired) build; the pass matrix is recorded.

## L4 — Backup & disaster-recovery restore test (OPS)
**Why:** `COMPLETION_BRIEF` §F1: "Verify backups (3-2-1, EU geo-separate) with a test restore." Prove recovery *before* the DB holds real bookings.
```
Verify the backup and disaster-recovery posture:
- Confirm automated encrypted backups of Postgres (operational DB) and the Strapi DB on a 3-2-1
  scheme with at least one EU geo-separate copy; confirm Redis is treated as ephemeral (sessions/
  OTP/cache rebuildable) and RabbitMQ has DLQ persistence.
- Perform an ACTUAL restore into an isolated environment from the latest backup; bring the app up
  against the restored DB and run the L3 smoke subset (one booking, one portal read) to prove
  integrity.
- Record measured RTO and RPO; confirm the audit_log restores intact and append-only grants survive
  the restore.
- Document the restore runbook and the backup retention/rotation policy.
```
**Done when:** a real restore succeeds and the app runs against it; RTO/RPO measured and documented; audit_log immutability survives restore; runbook written.

## L5 — Monitoring, alerting & on-call (OPS)
**Why:** `COMPLETION_BRIEF` §F1: "Confirm monitoring/alerting on booking, queue depth/DLQ, HIS sync failures, and auth errors." You can't safely soft-launch what you can't observe.
```
Stand up observability for the launch (EU region, PII scrubbed per CONFIG_AND_ENV.md):
- Metrics + alerts on: booking success/failure rate and slot-lock contention; RabbitMQ queue depth
  and DLQ size; HIS sync failure/retry/dead-letter counts and reconciliation lag; auth errors (staff
  MFA + patient eID); payment webhook failures; APS feed staleness (fallback engaged).
- Uptime checks on the public site, /admin, the portal, and each integration health endpoint.
- Error monitoring (Sentry or equivalent) wired with PII scrubbing; LOG_LEVEL=info in prod.
- Define alert thresholds, routing, and an on-call rota for launch week; dashboards for the go/no-go
  call. Confirm audit_log access events surface in security monitoring.
```
**Done when:** dashboards + alerts cover booking, queue/DLQ, HIS sync, auth, payments, and APS fallback; uptime checks are live; on-call rota is set for launch week; a synthetic alert was fired and routed to confirm the path works.

## L6 — External VAPT pen-test + triage (OPS)
**Why:** `COMPLETION_BRIEF` §F1 + `CLAUDE.md`/Decree 179/2020: independent security sign-off is a launch blocker.
```
Commission an external VAPT pen-test against the green, monitored staging system. Scope: public
site, /admin (RBAC + MFA), patient portal (eID/OIDC + step-up 2FA on lab-result PDF), booking +
onboarding APIs (incl. forged-request rejection), payment flow, and infra/network (TLS 1.3, headers,
secrets exposure). Triage findings by severity; fix all critical/high BLOCKERS and re-test to
closure; log medium/low with owners and target dates. Produce the pen-test report + remediation
record for the compliance file.
```
**Done when:** pen-test complete; all critical/high findings fixed and re-tested closed; residual findings tracked with owners; report filed for Decree 179/2020 evidence.

## L7 — Hospital staff content review + real media (BUILD + hospital staff)
**Why:** `PUNCHLIST` Task 7 + the README note that all imagery is `.ph` placeholders: machine-translated clinical text must be human-reviewed, and real photos/PDFs must replace placeholders before patients see the site.
```
Drive the content sign-off in Strapi:
- SK is the human-authored source; EN is human-authored. For cs/pl/hu/uk, ensure clinical/safety-
  critical collections (departments, clinics, services, news) are DRAFTS in "needs review" state and
  route them to hospital staff for approval — never auto-publish. Confirm glossary terms
  (TRANSLATION_GLOSSARY_ID) are preserved.
- Replace every .ph image placeholder with real media via the CMS media field (department photos,
  facility/map shots) using the Slovak/English labels in the prototype as the shot list. Attach the
  real disclosure PDFs to the zverejnovanie file fields.
- Have hospital staff verify clinic booking RULES one more time against reality (bookingDays/window/
  referral/status), since these now drive real bookings.
Provide staff a short editing runbook (login + MFA, list/editor, publish/needs-review workflow).
Nothing in cs/pl/hu/uk publishes without a human approval.
```
**Done when:** SK/EN content is staff-approved; cs/pl/hu/uk clinical pages are reviewed-and-published (not machine-auto-published); all `.ph` placeholders replaced with real media; disclosure PDFs attached; staff confirmed booking rules; editing runbook delivered.

## L8 — Launch records: DSAR/erasure runbook, retention, legal text (BUILD)
**Why:** `COMPLETION_BRIEF` A3 and `PUNCHLIST` Task 6 both say to **add the DSAR + erasure items to LAUNCH_CHECKLIST.md** and ship `RETENTION.md`. Close that loop here.
```
Finalize the GDPR launch records:
- Confirm the admin DSAR tooling works end to end on the production build: Right of access (Art. 15)
  exports a subject's web-tier data (bookings, onboarding, consents, SMS logs, payments) excluding
  HIS clinical records with the HIS-controller note; Right to erasure (Art. 17) deletes/anonymizes
  web-tier data while preserving legally-required financial/disclosure records, writing an audit
  entry of erased-vs-retained-with-reason. Both are admin-role, MFA-gated, fully audited.
- Confirm RETENTION.md exists (retention periods + lawful basis) and is referenced from the kontakt
  GDPR section.
- Verify the cookie banner + DPO-approved privacy/cookie/accessibility text are live on the kontakt
  page (#gdpr, #pristupnost) in SK + EN, and that the Accessibility Statement reflects the L3 axe
  result and Act 351/2022.
Record the DSAR operator procedure (how to run an access/erasure request) in this checklist's
appendix.
```
**Done when:** DSAR access + erasure run on the production build (audited); RETENTION.md shipped and linked; cookie/privacy/accessibility legal text live in SK+EN; DSAR operator procedure documented.

## L9 — Go/No-go gate → soft-launch (FRO) → full launch (JOINT)
**Why:** The controlled cutover from `COMPLETION_BRIEF` §F1 and the README hand-off: "soft-launch (FRO first) → full launch… Keep a documented rollback."
```
Hold a go/no-go review against the gate below; proceed only on all-green. Then execute the staged
launch with rollback ready at each step.

GO/NO-GO GATE (all must be GREEN):
  [ ] L1 secrets injected, mocks off, config validator passes in production
  [ ] L2 every integration smoke-passed on EU staging
  [ ] L3 full CI suite green (unit + integration + E2E sk/en/mobile + axe)
  [ ] L4 backup restore verified; RTO/RPO documented
  [ ] L5 monitoring/alerting live; on-call rota set; synthetic alert routed
  [ ] L6 pen-test critical/high findings closed
  [ ] L7 content staff-approved; real media in; booking rules staff-confirmed
  [ ] L8 DSAR/erasure live; RETENTION.md + legal text shipped

SOFT-LAUNCH (FRO only):
- Enable online booking for FRO (one pilot clinic) only; all other clinics remain
  read-only/"booking unavailable". Cut DNS/traffic to production.
- Monitor for a defined burn-in window (e.g. 1–2 weeks): booking success rate, HIS sync DLQ, auth
  errors, APS fallback, payment webhooks, a11y/error reports. Triage daily.
- Collect hospital-staff and patient feedback; fix blockers before widening.

FULL LAUNCH:
- After a clean burn-in, enable booking for all bookable clinics (respecting each clinic's rules/
  status). Announce. Keep monitoring at launch-week cadence.

ROLLBACK (documented, rehearsed):
- Per-clinic kill switch (disable booking → "booking unavailable" state) and a full traffic
  rollback to the prior state, with the L4 restore runbook on standby. Define the trigger criteria
  (e.g. sustained booking failure, HIS sync loss, security incident) and who can call it.

Produce a final go/no-go summary recording the decision, the gate state, the soft-launch metrics,
and the full-launch sign-off. Update this checklist with results.
```
**Done when:** gate all-green and recorded; FRO soft-launch ran a clean burn-in; full launch executed with monitoring at launch cadence; rollback documented and rehearsed; final go/no-go summary filed.

---

## Definition of done (this brief — and the product)
- Real vendor accounts provisioned (EU); all secrets vaulted; mocks off; config validator enforces production invariants.
- Every integration (eID, HIS, SMS, payments, NCZI, APS, Translation) proven on EU staging, then production.
- Full automated suite green against live-wired, Strapi-sourced services (unit + integration + E2E sk/en/mobile + axe).
- Backups restore-tested (3-2-1, EU geo-separate); RTO/RPO documented; audit immutability survives restore.
- Monitoring/alerting + on-call live across booking, queue/DLQ, HIS sync, auth, payments, APS.
- External VAPT pen-test: critical/high findings closed; report filed.
- All content staff-approved; cs/pl/hu/uk clinical pages human-reviewed; real media + disclosure PDFs in; booking rules staff-confirmed.
- GDPR DSAR/erasure live and audited; RETENTION.md + cookie/privacy/accessibility text shipped.
- Soft-launch (FRO) → full launch executed with a documented, rehearsed rollback; go/no-go summary filed.

**After this brief:** the platform is **live**. What remains is steady-state operations, not roadmap build: ongoing content authoring by staff, periodic accessibility + security re-audits, dependency/patch maintenance, monitoring of queue/DLQ and HIS sync health, and rolling the remaining locales (cs/pl/hu/uk) out of draft as hospital staff complete their reviews.
