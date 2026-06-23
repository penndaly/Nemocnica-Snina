# Claude Code Build Guide — Nemocnica Snina (prompt by prompt)

This is the **end-to-end build playbook** for the full product described in the two planning documents — not just the prototype. Work through it **in order**. Each step has:

- **Goal** — what you're building
- **Prompt** — paste this into Claude Code (edit bracketed choices first)
- **Reference** — which handoff file to point Claude at
- **Done when** — acceptance criteria to verify before moving on

> Always keep the handoff bundle (`design_handoff_nemocnica_snina/`) in the repo. Most prompts say "follow the handoff" — Claude should read `README.md`, `PRODUCTION_ARCHITECTURE.md`, `DATA_MODEL.md`, and `CLAUDE.md` as the source of truth for UI, content, architecture, and constraints.

**Scope map (where each requirement from the docs gets built):**

| Doc requirement | Phase |
|---|---|
| Promotional portal (departments, clinics, doctors, services, facilities, news, disclosures) | 1–3 |
| Admin CMS with RBAC + MFA | 2 |
| 6-language i18n (sk, cs, pl, hu, uk, en) + Google Cloud Translation + glossaries | 1, 9 |
| Intelligent scheduling (referral validation, clinic rules, SMS/OTP, RČ check) | 4 |
| New-patient onboarding / eDohody + NCZI XML | 5 |
| Patient portal + lab results + FHIR R4 | 6 |
| HIS / NCZI / e-VÚC APS / SMS / payments integrations | 7 |
| GDPR, Decree 179/2020, Accessibility Act 351/2022 | 8 (woven throughout) |
| Performance, testing, pen-test, launch | 9 |

---

## Phase 0 — Foundations

### 0.1 Repo scaffold & decisions
**Goal:** Monorepo, stack chosen, EU-hosting + compliance constraints baked into project rules.

**Prompt:**
```
Read design_handoff_nemocnica_snina/ in full, starting with CLAUDE.md, README.md, and
PRODUCTION_ARCHITECTURE.md. This is the design + content + architecture source of truth for
the Nemocnica Snina hospital platform. We are building the PRODUCTION system — do not ship the
localStorage prototype.

Scaffold a monorepo with:
- apps/web      → Next.js (App Router) + React + TypeScript, locale-prefixed routes /[lang]
- apps/api      → [NestJS | Laravel] for booking, onboarding, portal, integrations
- packages/ui   → shared React components + design tokens
- packages/types→ shared TS types generated from DATA_MODEL.md
- infra/         → IaC + docker-compose for local (Postgres, Redis, RabbitMQ, CMS)

Copy CLAUDE.md to the repo root as the project rules. Add a README that states the
non-negotiables: EU-only hosting, TLS 1.3, AES-256 at rest, MFA for staff, WCAG 2.1 AA,
GDPR + Act 18/2018 + Decree 179/2020. Set up linting, Prettier, a strict tsconfig, and a CI
workflow that runs typecheck + lint + a placeholder test step. Do not write feature code yet —
just the skeleton. List what you created and the choices you made.
```
**Reference:** `CLAUDE.md`, `PRODUCTION_ARCHITECTURE.md`
**Done when:** repo builds, `docker-compose up` starts Postgres/Redis/RabbitMQ/CMS, CI is green, root `CLAUDE.md` present.

### 0.2 Design tokens → theme
**Goal:** Port the prototype's tokens so everything downstream matches the design.

**Prompt:**
```
Port the design tokens from design_handoff_nemocnica_snina/assets/styles.css into
packages/ui. Recreate the full token set (colors: medical blue scale, warm neutrals, warm ink,
terracotta/green/amber/red accents; typography: Newsreader for headings + Mulish for body/UI
with the exact sizes/weights; radius, shadow, spacing, breakpoints at 940/780/620px) as
[CSS variables | a Tailwind theme config]. Load Newsreader + Mulish. Build a /styleguide route
that renders every token and the core components (buttons, cards, badges, chips, table.data,
form fields, avatar, .ph image placeholder) so we can visually diff against the prototype.
Match it pixel-for-pixel.
```
**Reference:** `README.md` (Design Tokens + Components), `assets/styles.css`
**Done when:** `/styleguide` visually matches the prototype's components; fonts load; tokens centralized.

---

## Phase 1 — i18n shell & global chrome

### 1.1 Locale routing + language switch
**Goal:** 6-language routing done right (locale-prefixed, hreflang), starting with SK/EN content.

**Prompt:**
```
Implement internationalization for locales: sk, cs, pl, hu, uk, en. Use locale-PREFIXED routes
(/sk/..., /en/..., etc.) — never IP or cookie redirection. Default locale sk. On every page
inject reciprocal <link rel="alternate" hreflang="x"> for all locales plus x-default. Build the
i18n provider and a t()/L() helper matching the prototype: UI strings come from a message
catalog; CONTENT comes from the CMS as locale-keyed objects {sk,cs,pl,hu,uk,en}. Seed message
catalogs for sk + en now from the prototype's STR object (assets/site.js); leave cs/pl/hu/uk
catalogs stubbed for Phase 9 machine translation. Build the SK/EN language switch UI from the
prototype's utility bar.
```
**Reference:** `README.md` (Interactions → Language), `assets/site.js` (`STR`, `L`)
**Done when:** `/sk` and `/en` render; switching locale preserves the route; `hreflang` tags present; Lighthouse SEO sees alternates.

### 1.2 Header, utility bar, footer
**Goal:** Shared chrome on every page.

**Prompt:**
```
Build the global chrome as shared components in packages/ui, matching the prototype's
Site.mount() exactly: (1) utility bar — switchboard phone + emergency "112" link + SK/EN
switch; (2) sticky header — brand mark + name, 7-item primary nav with active states, "Patient
portal" (ghost) and "Book appointment" (primary) CTAs, hamburger + slide-down menu below 940px;
(3) footer — 4 columns (brand+address / Care / For patients / Mandatory information) + bottom
bar with copyright and "WCAG 2.1 AA · Act No. 351/2022". Use lucide-react for icons. All labels
come from the i18n catalog. Make nav keyboard-operable with visible focus.
```
**Reference:** `README.md` (Global chrome), `assets/site.js`
**Done when:** chrome matches prototype at desktop + mobile; nav is keyboard-accessible; links resolve to the route table in README.

---

## Phase 2 — Content model & Admin CMS

### 2.1 Schema, migrations, seed
**Goal:** Real database + CMS collections from the data model, seeded with the real content.

**Prompt:**
```
Using design_handoff_nemocnica_snina/DATA_MODEL.md, create the production content model in
[Strapi | Drupal] for these collections: departments, clinics, physicians, services,
facilities, news, disclosures; and singletons: hospital, pages. Use locale-keyed fields for all
bilingual fields (extendable to 6 locales). Preserve every field, type, enum, and relationship
in the doc — especially clinics.bookingDays (Mon=1…Sun=0), bookingWindow, referral, status,
bookable, and physicians.langs. Then write a seeder that imports the COMPLETE real content from
design_handoff_nemocnica_snina/assets/data.js (the SEED object) verbatim into the CMS/DB. Add a
matching PostgreSQL schema (via the API) for operational data: appointments, availability_slots,
booking, onboarding_application, audit_log, staff_user. Generate shared TS types in
packages/types. Do not seed any real patient data.
```
**Reference:** `DATA_MODEL.md`, `assets/data.js`, `assets/admin.js` (`SCHEMAS`/`SINGLETONS`)
**Done when:** all collections exist with correct fields; seed loads 7 departments, 8 clinics, 15 physicians, 8 services, 4 facilities, 5 news, 6 disclosures; types compile.

### 2.2 Admin CMS UI + RBAC + MFA
**Goal:** The non-technical-staff editor — the core requirement — with real auth.

**Prompt:**
```
Build the admin app (/admin, protected) that lets non-technical staff add/edit/replace ALL
content, recreating the prototype admin (design_handoff_nemocnica_snina/admin.html +
assets/admin.js): dark sidebar with Content collections (live counts), Settings singletons,
and Tools (export/import JSON, with a guarded reset); schema-driven list views (icon, title,
subtitle, status/feature badge, edit/delete, add-new); and the schema-driven editor with
SIDE-BY-SIDE locale inputs for bilingual fields, plus boolean switches, selects, reference
dropdowns, bilingual list (newline-per-item) fields, tags, number, date. Saving must publish to
the live site. Replace the prototype's password gate with real auth: OIDC, ROLE-BASED ACCESS
(editor / clinician / admin), and MANDATORY MFA for all staff accounts. Every create/update/
delete writes an immutable audit_log entry (who/what/when).
```
**Reference:** `README.md` (Admin CMS), `assets/admin.js`, `PRODUCTION_ARCHITECTURE.md` (security)
**Done when:** staff can CRUD every collection in SK+EN; edits appear on the public site; MFA enforced; RBAC blocks unauthorized actions; audit log records changes.

---

## Phase 3 — Public website

### 3.1 Home + departments + clinics + physicians
**Goal:** The promotional portal's primary pages, CMS-driven.

**Prompt:**
```
Build these public pages as server-rendered, CMS-driven routes, matching the prototype exactly
(layout, components, copy, responsive + a11y behavior) — read the per-screen specs in
design_handoff_nemocnica_snina/README.md:
- /[lang]                     index.html (hero, emergency card, quick access, accepting-new-
                              patients physicians, featured departments, news + APS panel)
- /[lang]/oddelenia           departments list
- /[lang]/oddelenia/[slug]    department detail (about, facilities checklist, related
                              physicians, sticky contact card)
- /[lang]/ambulancie          clinics (status badges, schedules, booking-rule callouts,
                              Book/disabled button driven by `bookable`)
- /[lang]/lekari              physician directory with search + "accepting new patients" filter
                              + language tags
Use the .ph placeholder for images, wired to CMS media fields. Everything reads from the CMS.
```
**Reference:** `README.md` (Screens), all listed prototype HTML files
**Done when:** pages match prototype at all breakpoints; data comes from CMS; editing content in admin updates these pages.

### 3.2 Services, diagnostics, news, disclosures, contact
**Goal:** Remaining public pages incl. legally-required disclosure + statements.

**Prompt:**
```
Build the remaining public pages per design_handoff_nemocnica_snina/README.md:
- /[lang]/sluzby         services & clinical practices (+ dark CTA band)
- /[lang]/diagnostika    diagnostics & support facilities (lab, radiology, reception, pharmacy)
- /[lang]/aktuality      news & announcements (badge per type, deep-linkable by id)
- /[lang]/zverejnovanie  public disclosures table (search + Contracts/Invoices filter, PDF
                         download per row — attach real PDFs from a CMS media/file field)
- /[lang]/kontakt        contact + about + GDPR (#gdpr) + Accessibility (#pristupnost) sections
Ensure footer "Mandatory information" links anchor correctly. Disclosures must be filterable and
each row downloadable.
```
**Reference:** `README.md` (News, Public disclosures, Contact), prototype HTML
**Done when:** all pages live and CMS-driven; disclosure PDFs download; legal sections present and linked.

---

## Phase 4 — Intelligent scheduling

### 4.1 Availability + booking engine (server-enforced rules)
**Goal:** The scheduling brain — clinic-specific rules enforced on the server.

**Prompt:**
```
Build the appointment scheduling engine in apps/api + the booking wizard UI matching
design_handoff_nemocnica_snina/objednanie.html (5 steps: Clinic → Date → Time → Details →
Confirm; accepts ?clinic=<id> deep-link). Enforce ALL rules SERVER-SIDE from the clinic record
(DATA_MODEL.md): only offer dates whose weekday is in bookingDays (Mon=1…Sun=0); honor
bookingWindow (e.g. Angiology Thu/Fri 13:00–14:00); block booking when status is closed/alert or
bookable=false; require a referral (výmenný lístok) confirmation when referral=true. Generate
availability_slots per clinic and lock a slot on booking to prevent double-booking. Validate the
patient's rodné číslo with the modulo-11 algorithm. On confirm, create a booking with a unique
ID. GDPR consent (Art. 9) is mandatory; referral consent conditional. Make the form fully
keyboard + screen-reader accessible.
```
**Reference:** `README.md` (Booking wizard + business rules), `DATA_MODEL.md` (clinics)
**Done when:** wizard matches prototype; impossible dates/slots can't be selected or submitted; RČ validation works; double-booking prevented; booking persists with ID.

### 4.2 SMS auth, confirmations, reminders, cancellation
**Goal:** OTP + lifecycle messaging.

**Prompt:**
```
Add SMS to the booking flow via [SMS gateway]: OTP verification before confirming a booking;
send a confirmation SMS with the booking ID and a one-click cancel link; schedule a reminder
48–72h before the appointment; handle cancellations (free the slot, log it). Store only the
minimal data needed on the web tier (name, contact, booking time) — no clinical detail. Make all
message templates locale-aware and editable.
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` (scheduling + SMS), `README.md` (state table)
**Done when:** OTP gates confirmation; confirmation/reminder/cancel SMS fire; cancel frees the slot; templates localized.

---

## Phase 5 — New-patient onboarding (eDohody)

### 5.1 Onboarding flow + staff review + NCZI XML
**Goal:** The "Accepting new patients" → capitation-contract pipeline from the docs.

**Prompt:**
```
Build the new-patient onboarding module (eDohody). Public side: a capacity check (only physicians/
clinics with accepting=true/acceptingNew=true accept applications), then a digital application
form (patient details, insurer, chosen physician). Staff side (in admin, clinician/admin role):
a review queue to accept or reject applications. On acceptance, generate the NCZI eDohoda XML
(patient rodné číslo, insurer code, doctor code, validity date) per the schema in
PRODUCTION_ARCHITECTURE.md, and notify the patient to sign via eID. Persist applications in
onboarding_application with full audit logging. Surface "accepting new patients" status on the
physician directory and department/clinic pages (already in the content model).
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` (module 3 + eDohody), `DATA_MODEL.md`
**Done when:** patient can apply only where capacity allows; staff can accept/reject; accepted application produces valid eDohoda XML; patient is notified to sign; all steps audited.

---

## Phase 6 — Patient portal & FHIR

### 6.1 Authenticated portal + records/meds/labs
**Goal:** Secure portal mapped to FHIR — real data, never seeded.

**Prompt:**
```
Build the patient portal (/[lang]/portal) matching design_handoff_nemocnica_snina/portal.html
(login → dashboard with Overview / Health records / e-Prescriptions / Lab results). Replace the
demo login with real patient authentication (OIDC / national eID) + 2FA. Map records to FHIR R4
resources: Condition (diagnoses), MedicationRequest (e-prescriptions), Observation (lab results),
Appointment (upcoming). Read these from [Cloud Healthcare API | HIS FHIR endpoint] for the
authenticated patient only — never store or seed real patient data in our DB. Lab-result PDF
download must be behind 2FA. Add a refill-request action (queues a message to the physician).
Keep the exact dashboard UI/UX from the prototype.
```
**Reference:** `README.md` (Patient portal), `DATA_MODEL.md` (Patient/FHIR), `PRODUCTION_ARCHITECTURE.md` (module 4)
**Done when:** patient logs in with 2FA; records/meds/labs load from FHIR; PDF download gated; no patient data in our DB; UI matches prototype.

---

## Phase 7 — Integrations

### 7.1 HIS via async queue
**Prompt:**
```
Integrate the Hospital Information System. NO direct web→HIS DB writes. Route booking +
onboarding events through an async queue (RabbitMQ): API → queue → sync agent → HIS via
[HL7 v2 | FHIR]. Make it resilient: bookings must survive an HIS outage and reconcile when it
recovers (retry + dead-letter + idempotency). Log every sync attempt to audit_log.
```
**Done when:** bookings/onboarding reach HIS via queue; an HIS outage doesn't lose bookings; replays are idempotent.

### 7.2 NCZI eObjednanie + e-VÚC APS feed
**Prompt:**
```
(a) Integrate NCZI eObjednanie (REST/FHIR) so national-scheduling sync is possible for relevant
clinics. (b) Replace the static APS ("who's on duty") content on the home + contact pages with a
LIVE feed from the e-VÚC / Prešov region (PSK) API, so the ambulatory-emergency-service schedule
is always accurate with zero manual upkeep. Cache the feed (Redis) with a short TTL and fall back
to the CMS pages.aps text if the feed is unavailable.
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` (Integrations)
**Done when:** APS info is live from the regional API with graceful fallback; NCZI sync path proven for at least one clinic.

### 7.3 Payments
**Prompt:**
```
Add a PCI-compliant payment gateway for paid items (medical certificates/documents, applicable
LSPP fees shown on clinics like General Surgery's €1.99). Issue receipts; record transactions;
localize the checkout. Keep card handling entirely within the gateway (no PAN on our servers).
```
**Done when:** a paid document can be purchased end-to-end; receipt issued; no card data touches our servers.

---

## Phase 8 — Security, compliance & accessibility hardening

### 8.1 Compliance pass
**Prompt:**
```
Do a full compliance hardening pass against PRODUCTION_ARCHITECTURE.md:
- GDPR + Act 18/2018: lawful-basis review, granular opt-in consent records, data minimization on
  the web tier, retention policy, data-subject-access + erasure tooling, cookie banner + DPO-
  approved privacy/cookie text wired into the kontakt page sections.
- Decree 179/2020: enforce TLS 1.3, AES-256 at rest, MFA on all staff accounts, and verify the
  immutable audit_log covers every access to personal/health data.
- Secrets management, rate limiting, input validation, OWASP Top 10 review.
Produce a checklist of what passed and what needs policy/legal input.
```
**Done when:** checklist complete; encryption + MFA + audit verified; legal text in place.

### 8.2 Accessibility (WCAG 2.1 AA — legal)
**Prompt:**
```
Audit and fix the entire site to WCAG 2.1 AA (Act 351/2022). Verify keyboard operability,
screen-reader semantics, focus management, color contrast, and ARIA on all forms (especially the
booking wizard and onboarding). Add a high-contrast toggle and a text-resize control. Run
axe/Lighthouse on every route and fix violations. Publish/refresh the Accessibility Statement on
the kontakt page with the audit result.
```
**Reference:** `README.md` (Accessibility), `CLAUDE.md`
**Done when:** axe/Lighthouse a11y ~100 on all routes; high-contrast + text-resize work; statement updated.

---

## Phase 9 — Multilingual rollout, performance, testing, launch

### 9.1 Full 6-language rollout
**Prompt:**
```
Activate locales cs, pl, hu, uk in addition to sk/en. Build the translation pipeline from
PRODUCTION_ARCHITECTURE.md: Google Cloud Translation Advanced (v3) / Adaptive for machine
translation, with Custom Glossaries locking brand/department/clinical terms. Author SK by hand
(source), machine-translate the rest, and flag clinical/critical pages for human review before
publish. Cache translations (Redis app-layer + CDN edge) to control cost. Verify hreflang covers
all six locales + x-default.
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` (Multilingual)
**Done when:** all 6 locales render; glossary terms preserved; clinical pages human-reviewed; caching in place.

### 9.2 Performance & SEO
**Prompt:**
```
Optimize for Core Web Vitals and SEO: SSG/ISR for content pages, CDN caching, image optimization
for CMS media, font preloading, route-level code splitting. Add sitemap.xml (all locales),
robots.txt, structured data (MedicalOrganization / Physician / MedicalClinic schema.org).
Target Lighthouse ≥90 across Performance/SEO/Best-Practices/Accessibility on key routes.
```
**Done when:** Lighthouse targets met; sitemaps + structured data validate.

### 9.3 Testing & launch
**Prompt:**
```
Add the test + release suite: unit tests for booking-rule enforcement and RČ validation;
integration tests for booking, onboarding, and HIS queue resilience; E2E (Playwright) for the
booking wizard, onboarding, and portal across sk/en; automated a11y checks in CI. Commission an
external VAPT pen-test and triage findings. Then prepare launch: staff training notes for the
admin CMS, a soft-launch plan (enable booking for one clinic — FRO — first), monitoring/alerting,
and backup verification (3-2-1, EU geo-separate). Produce a go-live checklist.
```
**Reference:** `PRODUCTION_ARCHITECTURE.md` (phasing), `CLAUDE.md`
**Done when:** test suites green in CI; pen-test findings triaged; soft-launch + rollback plan documented; backups verified.

---

## Working tips for Claude Code
- **One phase per session** where possible; commit between steps so each prompt has a clean base.
- If Claude drifts from the design, say *"re-read the per-screen spec in README.md and match it exactly."*
- Treat **`DATA_MODEL.md` as contract** — if a field is missing in the build, it's a bug.
- The booking rules and security non-negotiables are the two areas to **review by hand** — don't take them on trust.
- When in doubt about look/behavior, the prototype HTML is the answer; when in doubt about stack/integration/compliance, `PRODUCTION_ARCHITECTURE.md` is the answer.
```
