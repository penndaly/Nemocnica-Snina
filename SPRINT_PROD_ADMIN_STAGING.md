# Sprint — Production Admin Portal + Integration Health Dashboard + EU Staging

## Context (read first)
- `CLAUDE.md` (repo root) — non-negotiables, stack, local dev.
- `design_handoff_nemocnica_snina/` — design source of truth (HTML prototypes).
- Repo: `penndaly/Nemocnica-Snina`, branch `main`. Confirmed via GitHub inspection (2026-08-24):
  - Wearables W1–W6 + WL9 are **already merged to main** (`apps/api/src/wearables/` has all adapter, cron, digest, oauth-state files).
  - **Three PRs are still open, unmerged**: `feature/ci-eslint-flat-config` (10 files/2 commits), `feature/ts-node16-migration` (4 files/2 commits), `feature/admin-a4-booking-wearables` (23 files/3 commits — adds `booking-admin.*`, `wearables-admin.*`, `wearables-monitoring.*`).
- **Merge these three first, in this order, before starting the work below**: CI-LINT-1 → TS-M1 → A4. All are small, mechanical, and already documented in `SPRINT_CI_LINT_FLAT_CONFIG.md` / `SPRINT_TS_M1_RELAND.md` / earlier A4 sprint notes. A4 is the one that matters most here — it's what makes booking-admin and wearables-admin/monitoring APIs exist on main at all.

## Why this sprint
The prototype (`admin.html`) and the sprint docs describe a fully capable admin backend (A1 CMS API, A2 auth/RBAC, A3 audit/GDPR/translation, A4 booking + wearables admin). But **no production `/admin` React UI exists yet** — admin capability today is either the localStorage-backed HTML prototype, or raw APIs with no UI. The business owner needs to actually operate the site (edit/hide/show content, manage bookings, monitor wearables, see audit logs) without touching the database or a prototype that doesn't persist. This sprint closes that gap, plus makes the demo checkable from a shared URL instead of one laptop, plus adds the health-monitoring surface that's been assumed but never built.

## Firebase — scope lock (do this first, it's small)
`pnpm add firebase --filter web` (confirm the exact filter name against `apps/web/package.json`). Client-side only, `apps/web` only. Only `firebase/app` + `firebase/analytics`. No Firestore, Auth, Storage, or Realtime Database. No patient, booking, or clinical data of any kind touches it — analytics events only (page views, funnel events). This does not require a residency exception; if anyone proposes using Firebase for auth or data storage later, that's a separate architecture decision requiring sign-off, not a follow-on to this sprint.

## Phase 1 — Production Admin Portal (`apps/web/src/app/admin/`)
Build the real React admin app, wired to the APIs that already exist (A1/A2/A3/A4), replacing the prototype for actual use. Reuse `packages/ui` design tokens; match `admin.html`'s information architecture and interaction patterns (the design source of truth) rather than reinventing layout.

Required sections, each backed by its existing API (do not re-invent endpoints — wire to what A1–A4 shipped):
1. **Content CRUD** — Departments, Clinics, Physicians (with photo upload), Services, Facilities, News, Disclosures, plus the Hospital Info + Page Content singletons. Add/Edit/Delete/Publish, with the CS/PL/HU/UK translation-draft gate visible in the UI (A3's `review_status` field).
2. **Booking admin** — list/filter/search bookings, cancel/reschedule/mark-no-show, clinician clinic-scoping enforced by the UI matching the API's scope guard. Wire to `booking-admin.controller.ts`.
3. **Wearables admin** — platform management (write-only credential fields, partnership/Huawei gate toggles, connection test), monitoring (summary, alert log, CSV export), threshold editor (physician → global → hardcoded resolution visible in the UI). Wire to `wearables-admin.controller.ts` + `wearables-monitoring.controller.ts`.
4. **Audit log viewer** — read-only, paginated, filterable by actor/action/date. Wire to A3's `/api/audit`.
5. **GDPR tools** — DSAR export + erasure request handling. Wire to A3's GDPR endpoints.
6. **Translation review queue** — approve/reject machine-translated drafts before publish. Wire to A3's translation gate.
7. **Super Admin: user management** — staff accounts, roles, MFA reset, session revoke. Wire to A2's `/api/admin/users`.

Auth: staff JWT via the existing `AdminAuthContext` + `StaffJwtGuard`/`ScopeGuard`/`StaffRolesGuard` (A2). No new auth pattern.

Axe WCAG 2.1 AA pass required on every new admin route (this was previously deferred — see A4's `test.fixme` note in Project Overview §7). Run it for real this time; there's browser infra available now that this is a real deploy, not just a build-env unit-test run.

## Phase 2 — Integration & infra health dashboard
A new admin page (`/admin/health` or similar) that answers "is everything actually working" at a glance, in mock mode today and against real vendors after L1-PREP:
- **Per-integration status cards**: eID/OIDC broker, HIS/NCZI eZdravie sync (queue depth + DLQ count from RabbitMQ), SMS provider, payment gateway (GP webpay/Stripe-EU), Google Cloud Translation, LiveKit (telemedicine), each of the 8 wearables adapters (medical + consumer) — last successful call, current mode (mock/live), error rate over the last hour.
- **Infra status**: Postgres connection pool health, Redis reachability, RabbitMQ queue/consumer counts and DLQ sizes, background cron last-run timestamps (retention purge, consent-grace, batch-alert digest).
- Build this on a single `/api/admin/health` aggregator endpoint (new, small) that fan-outs to each service's existing health-check rather than the UI calling N endpoints directly.
- This is the concrete version of the "integration-readiness" surface referenced in `SPRINT_L1_PREP_VENDOR_PROVISIONING.md` Part D — reuse that spec, don't duplicate it. Coordinate so L1-PREP's config-validator work and this dashboard read the same status source.

## Phase 3 — EU staging deployment (shared, clickable URL)
The business owner needs to demo this to others without their laptop. This is infra, not a code sprint, but scope it so Claude Code can execute the parts that are code (Docker/CI) while flagging what needs a human to click "create":
- Stand up `docker-compose.production.yml` (already in the repo) on a single EU-region host (or EU-region managed Postgres/Redis + a container host) — this can run with `OIDC_MOCK_ENABLED=true` / `HIS_MOCK_ENABLED=true` / wearables in mock mode. **Do not** set the production-only mock-rejection flags to true yet — this is a demo/staging environment, not the go-live target, so mocks are expected and fine here.
- Needs real: a domain or subdomain, TLS cert, and one EU hosting account (e.g. a EU-region VM/PaaS) — flag this as the one human "create an account" step; everything else (compose file, env template, CI deploy step) can be written now.
- Add a CI job (or documented manual step) that deploys `main` to this staging host on merge, so the shared URL always reflects the latest merged work.
- This is deliberately **separate** from the real L1–L9 launch gate (that's for actually going live with real patients and real vendor credentials, after the contract is won) — staging is mock-mode-forever until that decision is made.

## Done when
- [ ] CI-LINT-1, TS-M1, A4 merged to `main` in that order.
- [ ] Firebase Analytics added to `apps/web` only, no other surface touched.
- [ ] Every admin capability listed in Phase 1 exists as a real, working `/admin` route backed by its real API — not the `admin.html` prototype.
- [ ] `/admin/health` shows live status for every integration + infra component, in mock mode.
- [ ] A shared staging URL is live and shows the same content as `main`, reachable without any local machine.
- [ ] axe WCAG 2.1 AA zero critical/serious on all new admin routes.
