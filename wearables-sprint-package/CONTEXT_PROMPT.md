# Context prompt — paste this at the start of a new chat

---

You are picking up **Nemocnica Snina** — a Slovak hospital's digital platform. Read this fully before writing any code or asking questions. Everything you need is here.

---

## What has been built

**GitHub:** `https://github.com/penndaly/Nemocnica-Snina` · `git clone git@github.com:penndaly/Nemocnica-Snina.git`

A production monorepo at commit `1c59502` (219 files, 7 commits). Stack: **Next.js 15 App Router · NestJS 10 · Strapi 4 · PostgreSQL + Prisma · Redis · RabbitMQ · Slovensko.sk eID OIDC · HL7 FHIR R4 · EU hosting.**

> **Package manager:** `pnpm` (workspaces). Never use `npm install` or `yarn` in this repo. Always `pnpm install` / `pnpm add`.

### Confirmed working
| Area | Detail |
|---|---|
| 11 public pages | Home, departments (+detail), clinics, physicians, services, diagnostics, news, disclosures, contact — CMS-driven, 6 locales (sk/en/cs/pl/hu/uk) |
| Booking wizard | 5-step; all clinic rules server-side (bookingDays, bookingWindow, bookable, status, referral, LSPP fee); atomic slot lock; RC validation; SMS OTP; GDPR consent |
| Booking cancellation | `/[lang]/objednanie/zrusit/[token]` |
| New-patient onboarding | Form → API → HIS queue → SMS — but eDohody XML and staff review queue are missing (see Sprint S1) |
| Patient portal | eID/OIDC · FHIR R4 (Conditions, Medications, Observations, Appointments) · step-up 2FA for lab PDF |
| Admin CMS | TOTP MFA · RBAC (editor/clinician/admin) · CRUD 9 collections · GDPR panel (Art. 15 + Art. 17) |
| HIS async queue | RabbitMQ · DLQ · idempotency · booking.confirmed/cancelled |
| SMS | OTP · booking confirmation · 48h reminder · cancel link |
| Payments | LSPP €1.99 session (mock in dev) |
| i18n | sk/en/cs/pl/hu/uk · locale-prefixed routes · hreflang · machine-translation pipeline (clinical content = drafts only, never auto-published) |
| Security | TLS 1.3 · TOTP MFA on all staff · DB-level audit log immutability (REVOKE + trigger) · bcrypt RC hashes |
| E2E + CI | 9 Playwright specs · axe WCAG 2.1 AA on 10 routes · full CI pipeline |

### Not yet built
Everything below is specified in the handoff package and waiting to be built.

---

## The handoff package

The folder `design_handoff_nemocnica_snina/` in the repo root is the source of truth. Key files:

| File | Read when |
|---|---|
| `README.md` | UI/UX spec, design tokens, all screen specs |
| `DATA_MODEL.md` | Postgres schema + Strapi collections — treat as contract |
| `PRODUCTION_ARCHITECTURE.md` | Stack decisions, integrations, compliance |
| `CLAUDE.md` | Project rules — already at repo root |
| `SPRINT_BACKLOG.md` | **Start here** — gap analysis + all sprint prompts |
| `TELEMEDICINE_README.md` | Telemedicine screen specs |
| `TELEMEDICINE_BUILD_GUIDE.md` | Telemedicine phase-by-phase prompts (T0–T5) |
| `TELEMEDICINE_DATA_MODEL.md` | 3 new tables + schema extensions |
| `TELEMEDICINE_ARCHITECTURE.md` | LiveKit, WebRTC flow, GDPR/NIS2/MDR |
| `TELEMEDICINE_COMPLIANCE_REVIEW.md` | 3 legal blockers + 5 required gaps — read before building telemedicine |
| `TELEMEDICINE_CONFIG.md` | 9 new env vars, DPA requirements |
| `TELEMEDICINE_E2E_TESTS.md` | SPEC TH-1 through TH-6 |

Prototype HTML files (UI references, not production code):
- `telehealth.html` — public telehealth landing page
- `teleconsult.html` — video consultation room (3 states × 2 views; toggle bar at top)

---

## What to do next — sprint order

```
S1–S4 have no dependencies on each other. Run in parallel if possible.
S5 gates on S1–S3. S6–S11 are sequential and depend on S1.

S1 → eDohody staff review queue + NCZI XML       🔴 legal gap
S2 → APS live feed (home + contact)              🟡 unconfirmed
S3 → Portal + payments (eZdravie, refills,       🔴 legal gap (eZdravie)
      receipts, cancel link)
S4 → Compliance docs (RETENTION.md,              🔴 legal gap
      NIS2 procedure, MDR exclusion)
S5 → UI/UX verification pass                     🟡 hardening

S6  → Telemedicine: DB migrations + Strapi extensions + TelehealthModule + LiveKit
S7  → Telemedicine: booking wizard ?mode=telehealth + public landing page
S8  → Telemedicine: video consultation room (patient side)
S9  → Telemedicine: portal teleconsultations section + physician console
S10 → Telemedicine: HIS FHIR Encounter + full compliance hardening
S11 → Telemedicine: admin config + E2E tests TH-1–TH-6 + launch gate
```

Full paste-ready prompts for every sprint are in `SPRINT_BACKLOG.md`.

---

## Conventions — never break these

- **Booking rules are enforced server-side.** Client UI is cosmetic. A forged POST must be rejected.
- **No direct web → HIS DB writes.** All HIS events go through RabbitMQ → sync agent → HL7/FHIR.
- **Audit log is append-only at the DB layer** (REVOKE UPDATE/DELETE + trigger). Every sensitive action writes an entry.
- **No patient RC in plaintext.** bcrypt hash only.
- **MFA required for all staff accounts.** No bypass in production.
- **Machine-translated clinical content (cs/pl/hu/uk) is always a draft.** Lifecycle hook blocks auto-publish.
- **`OIDC_MOCK_ENABLED=false` and `HIS_MOCK_ENABLED=false` in production.** Config validator enforces.
- **EU hosting only.** Decree 179/2020 — TLS 1.3, AES-256 at rest, no data outside EU.
- **WCAG 2.1 AA is a legal requirement** (Act 351/2022). axe must be zero critical/serious on every route.

### Telemedicine additions (once you reach S6+)
- `TELEHEALTH_RECORDING_ENABLED=false` in production. Config validator requires `TELEHEALTH_RECORDING_DPO_APPROVED=true` to override.
- **No patient identity in `telehealth_sessions`** — opaque `patient_token` only.
- **TURN servers must be EU-resident** — `LIVEKIT_TURN_REGION=eu` validated in production (GDPR Art. 46).
- **NCZI eZdravie is the legally valid prescription** (Act 362/2011). FHIR MedicationRequest in HIS is the clinical copy only.
- **Physician join requires MFA re-verify** at the endpoint, not just an active session.
- `TELEHEALTH_PROVIDER=mock` in dev/CI only.

---

## OPS tasks (no code — do not implement)

| Task | Status |
|---|---|
| L1 — Provision 14 vendor accounts; inject secrets; kill mocks | ⬜ Not started |
| L4 — Backup + DR restore drill | ⬜ Blocked by L1 |
| L5 — Monitoring, alerting, on-call rota | ⬜ Blocked by L1 |
| L6 — External VAPT pen-test | ⬜ Blocked by L1 |
| L9 — Go/no-go gate → FRO soft-launch → full launch | ⬜ Blocked by L1/L4/L5/L6 |

---

## Verified from live repo scan (github.com/penndaly/Nemocnica-Snina)

| Module | File confirmed | Status |
|---|---|---|
| APS live feed | `apps/api/src/aps/aps.service.ts` | ✅ Built — 10-min in-memory cache, PSK API fetch, fallback |
| NCZI eDohoda XML | `apps/api/src/onboarding/nczi-xml.service.ts` | ✅ Built — generates XML per NCZI schema |
| Onboarding review API | `apps/api/src/onboarding/onboarding.service.ts` | ✅ Built — `review()` accept/reject, audit log, XML call |
| Admin onboarding UI | `apps/web/src/app/admin/onboarding/` | ✅ Exists |
| All 11 public pages | `apps/web/src/app/[lang]/` (14 routes) | ✅ Confirmed |
| Admin (all collections + GDPR) | `apps/web/src/app/admin/` | ✅ Confirmed |

**Known gap in onboarding XML:** `onboarding.service.ts` passes `'[REDACTED]'` as `patientRc` to `generateEDohoda()` — correct security behaviour (RC is only stored as bcrypt hash) but means the XML payload is incomplete. Needs a secure retrieval path or RC encryption at apply-time. Sprint S1 covers this fix.

## Local dev environment (confirmed running)

| Service | URL | Status |
|---|---|---|
| Next.js web | http://localhost:3000 | ✅ Running |
| NestJS API | http://localhost:4000/api/health | ✅ Running |
| PostgreSQL | localhost:5432 | ✅ Docker |
| Redis | localhost:6379 | ✅ Docker |
| RabbitMQ | localhost:5672 (mgmt: 15672) | ✅ Docker |

**Start Docker infra:** `docker compose -f infra/docker-compose.yml up -d`
**Start API:** `cd apps/api && pnpm dev`
**Start web:** `cd apps/web && pnpm dev`
**Package manager:** always `pnpm` — never `npm install`

### Local fixes already applied (NOT yet in GitHub — apply before building)
These fixes were made locally during dev setup and must be in place before any sprint:

| File | Fix |
|---|---|
| `apps/api/src/config/config.schema.ts` | `noChangeme(name, minLen=1)` — adds optional min-length param |
| `apps/api/src/auth/auth.service.ts` | `import * as otplib from 'otplib'`; `(otplib as any).authenticator.verify(...)` |
| `apps/api/src/his/his-sync.consumer.ts` | Queue topology mirrors publisher exactly (x-message-ttl, ns.his.dlx exchange) |
| `apps/api/tsconfig.json` | `"exactOptionalPropertyTypes": false`, `"noEmitOnError": false` |
| `apps/api/package.json` | Added: otplib, jose, @fastify/helmet@11, fastify |
| `apps/web/src/app/[lang]/layout.tsx` | Extracted skip link to SkipLink.tsx client component |
| `apps/web/src/components/SkipLink.tsx` | New file — `'use client'` skip-to-content link |
| `apps/web/src/messages/sk.json` + `en.json` | Removed duplicate top-level `"portal"` string |
| `apps/web/src/components/layout/SiteHeader.tsx` | `t('portal')` → `t('portal.title')` |
| `apps/web/next.config.ts` | Removed `experimental.typedRoutes` (Turbopack incompatible) |
| `pnpm-workspace.yaml` | `overrides: { better-sqlite3: "^11.0.0" }` |
| `apps/api/.env` | JWT_SECRET set to 64-char hex; all Docker service credentials wired |

### Commit all local fixes first
Before starting any sprint, commit these local fixes:
```bash
git add -A && git commit -m "fix: local dev setup — auth, HIS queue, tsconfig, i18n, SkipLink"
```

## How to proceed

1. Read `design_handoff_nemocnica_snina/SPRINT_BACKLOG_v2.md` in full.
2. Tell me which sprint to execute (S1–S11), or say "next" to start with S1.
3. I will execute **one sprint at a time**, commit, report Done-when criteria, and stop.

Do not start an OPS task. Do not combine sprints. Do not skip ahead.
