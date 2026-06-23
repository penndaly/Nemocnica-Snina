# CLAUDE.md — Nemocnica Snina production repo

Project instructions for Claude Code. Drop this at the repo root.

## What this is
Production build of the Nemocnica Snina (Snina Hospital) platform: a bilingual→multilingual public website + admin CMS + patient services (booking, onboarding, portal) + telemedicine module + wearables & remote-monitoring module. The `design_handoff_nemocnica_snina/` folder is the **design + content source of truth**.

> The handoff folder was extracted from a zip and once landed as `design_handoff_nemocnica_snina 5/` (a macOS dedup artefact). The canonical path is `design_handoff_nemocnica_snina/` (no suffix) — rename if it reappears suffixed. Wearables docs (`CONTEXT_PROMPT.md`, `SPRINT_BACKLOG_WEARABLES.md`, `assets/wearables-demo-data.js`) live inside it alongside the telemedicine handoff.

## Sources of truth
- **UI / UX / copy / tokens:** the HTML files + `assets/styles.css` in the handoff bundle.
- **Content model + seed data:** `assets/data.js` (`SEED`) → see `DATA_MODEL.md`.
- **CMS collections:** `assets/admin.js` (`SCHEMAS`/`SINGLETONS`).
- **Architecture / integrations / compliance:** `PRODUCTION_ARCHITECTURE.md`.
- **Sprint backlog + paste-ready prompts:** `SPRINT_BACKLOG_v2.md`.

## Stack (see architecture doc for rationale)
- Next.js 15 (App Router) + React + TypeScript, locale-prefixed routes (`/[lang]/…`), SSR/SSG.
- Headless CMS: Strapi 4 (self-hosted EU, PostgreSQL-backed).
- API: NestJS 10 + Fastify. DB: PostgreSQL (Prisma) + Redis. EU hosting.
- RabbitMQ for async HIS queue. LiveKit (EU) for telemedicine video.
- Icons: `lucide-react`. Design tokens in `packages/ui`.

## Local dev environment
| Service | URL |
|---|---|
| Next.js | http://localhost:3000 |
| NestJS API | http://localhost:4000/api/health |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |
| RabbitMQ | localhost:5672 (mgmt: 15672) |

**Start infra:** `docker compose -f infra/docker-compose.yml up -d`
**Start API:** `cd apps/api && pnpm dev`
**Start web:** `cd apps/web && pnpm dev`
**Package manager:** always `pnpm` — never `npm install` or `yarn`

## Database migrations (Prisma)
- Migrations live in `apps/api/prisma/migrations/`. Apply with `pnpm prisma migrate deploy`; never `prisma db push` against a tracked DB (it bypasses history and causes drift).
- **Baseline established (2026-06-23).** The dev DB was originally built outside Prisma history, so `migrate deploy` failed with **P3005** (schema not empty). Fixed by adding an empty `prisma/migrations/0001_baseline/migration.sql` and running `pnpm prisma migrate resolve --applied 0001_baseline`. From there, all later migrations (telehealth S6–S11, wearables W1+) apply normally. `pnpm prisma migrate status` should report "Database schema is up to date!".
- If you hit P3005 on a fresh/rebuilt DB, re-baseline the same way — mark `0001_baseline` applied, then `migrate deploy`.
- After editing `schema.prisma`, run `pnpm prisma generate` (no DB needed) so `@prisma/client` types stay in sync for `pnpm typecheck`.

## Local fixes already applied
> **Status:** these were committed as part of the Sprint W1 commit `f6b03a2` (`git add -A` folded `tsconfig.json` etc. in). No separate commit needed — the table below is kept as a record of what each fix was.

| File | Fix applied |
|---|---|
| `apps/api/src/config/config.schema.ts` | `noChangeme(name, minLen=1)` — min-length param |
| `apps/api/src/auth/auth.service.ts` | `import * as otplib`; `(otplib as any).authenticator.verify(...)` |
| `apps/api/src/his/his-sync.consumer.ts` | Queue topology mirrors publisher (x-message-ttl, ns.his.dlx) |
| `apps/api/tsconfig.json` | `exactOptionalPropertyTypes: false`, `noEmitOnError: false` |
| `apps/api/package.json` | Added: otplib, jose, @fastify/helmet@11, fastify |
| `apps/web/src/app/[lang]/layout.tsx` | Skip link extracted to SkipLink.tsx |
| `apps/web/src/components/SkipLink.tsx` | New `'use client'` skip-to-content component |
| `apps/web/src/messages/sk.json` + `en.json` | Removed duplicate top-level `"portal"` string |
| `apps/web/src/components/layout/SiteHeader.tsx` | `t('portal')` → `t('portal.title')` |
| `apps/web/next.config.ts` | Removed `experimental.typedRoutes` |
| `pnpm-workspace.yaml` | `overrides: { better-sqlite3: "^11.0.0" }` |
| `apps/api/.env` | JWT_SECRET 64-char hex; Docker credentials wired |

## Non-negotiables
- **Booking rules enforced server-side.** A forged POST must be rejected. Client UI is cosmetic.
- **No direct web → HIS DB writes.** All HIS events via RabbitMQ → sync agent → HL7/FHIR.
- **Audit log append-only at DB layer** (REVOKE UPDATE/DELETE + trigger). Every sensitive action.
- **No patient RC in plaintext.** bcrypt hash + AES-256-GCM encryption only.
- **MFA required for all staff accounts.** `MFA_REQUIRED=true` in production. No bypass.
- **Machine-translated clinical content (cs/pl/hu/uk) is always a draft.** Lifecycle hook blocks auto-publish.
- **`OIDC_MOCK_ENABLED=false` and `HIS_MOCK_ENABLED=false` in production.** Config validator enforces.
- **EU hosting only.** Decree 179/2020 — TLS 1.3, AES-256 at rest, no data outside EU.
- **WCAG 2.1 AA** — legal requirement (Act 351/2022). axe must be zero critical/serious on every route.

## Telemedicine non-negotiables (Sprints S6–S11)
- `TELEHEALTH_RECORDING_ENABLED=false` in production. Requires `TELEHEALTH_RECORDING_DPO_APPROVED=true` to override.
- **No patient identity in `telehealth_sessions`** — opaque `patient_token` only.
- **TURN servers must be EU-resident** — `LIVEKIT_TURN_REGION=eu` validated in production (GDPR Art. 46).
- **NCZI eZdravie is the legally valid prescription** (Act 362/2011) — FHIR MedicationRequest is the HIS copy.
- **Physician join requires MFA re-verify** at the endpoint, not just an active session.
- `TELEHEALTH_PROVIDER=mock` in dev/CI only; rejected in production by config validator.

## Wearables non-negotiables (Sprints W1–W6)
- **`WEARABLES_ENABLED=false` until the W6 compliance gate passes.** `WEARABLES_PROVIDER=live` is rejected by the config validator unless `WEARABLES_ENABLED=true`.
- **No patient identity in wearables tables** — opaque `patient_token` only (mirrors `telehealth_sessions`).
- **No raw OAuth tokens in logs or DB plaintext.** `oauth_*_token_enc` columns are AES-256-GCM via `TokenCryptoService`, keyed by `WEARABLES_TOKEN_KEY` (32-byte hex, config-validated). Decrypt failures throw `WearablesTokenError` and never log plaintext.
- **Explicit per-device GDPR consent before any sync.** `device_consent` row required; `ConsentGuard` throws `403 { code: 'WEARABLES_CONSENT_REQUIRED', deviceId }` when absent. Withdrawal revokes the provider token + soft-deletes un-synced readings.
- **FHIR-synced readings are immutable.** Never delete/overwrite a `device_readings` row whose `fhir_observation_id` is set (HIS holds the authoritative copy); add a `superseded_by` pointer instead. Consent withdrawal preserves these rows.
- **Cardiac implant platforms (Medtronic, Abbott Cardiac, Boston Scientific) + Meta require signed vendor agreements** — adapters return `partnership_required` until then.
- **Alert thresholds are clinician-configurable per patient** (`device_alert_thresholds`), not hardcoded.

### Wearables env (`apps/api/.env`, mirrored in `.env.example`)
```env
WEARABLES_ENABLED=false           # true only after W6 gate (L9 checklist + DPO sign-off)
WEARABLES_PROVIDER=mock           # mock | live (live rejected unless ENABLED=true)
WEARABLES_TOKEN_KEY=              # 32-byte hex — openssl rand -hex 32 (dev all-zero default rejected in prod)
WEARABLES_OAUTH_REDIRECT_BASE=http://localhost:4000
WEARABLES_GDPR_RETENTION_DAYS=90
WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS=90
WEARABLES_ALERT_SMS_TO=           # on-call escalation number for critical alerts (W5)
GARMIN_WEBHOOK_KEY=               # HMAC-SHA1 key for Garmin push webhooks (W6)
WEB_PORTAL_BASE_URL=http://localhost:3000  # public portal base for OAuth callback redirects (W4)
```

Sprint W1 (`feat(wearables)` commit `f6b03a2`) shipped the data model, `apps/api/src/wearables/` module (controller 501 stubs, `ConsentService`/`ConsentGuard`, `TokenCryptoService`, `MockAdapter`, `WEARABLE_ADAPTER` DI token), config gate, and tests. Sprints W4–W6 are complete on branch `feature/wearables-w4-portal-wiring` (commits c1aaf6a / ffeca73 / 5d55409, **not yet merged to main**), building on W1's MockAdapter (W2/W3 adapter branches were empty stubs):

- **W4** — `WearablesService` full implementation with idempotent 3-device demo seed; `platform-catalog.ts` (17 platforms, partnership/upload/iOS flags); `OAuthStateService` (HMAC-SHA256-signed one-time state); `ConsentService.setConsent`. Web: `apps/web/src/lib/wearables-api.ts`; catch-all proxy `app/api/portal/wearables/[...path]/route.ts` (reads httpOnly `ns_patient_session` cookie, forwards as `x-patient-session` to NestJS); **wearables added as a tab** in `portal/page.tsx` (no sidebar — it's a tabbed single page); `portal/wearables/sublas/page.tsx` GDPR consent management; sk/en `wearables` i18n namespace.
- **W5** — Migration `20260623100000_wearables_w5`: `portal_notifications` table + `@@unique([patientToken, metricType])` on `device_alert_thresholds`. `alert-thresholds.ts` (LOINC-coded `DEFAULT_THRESHOLDS` + pure `classify`); `AlertService`; `WearablesQueueService` (`ns.wearables` exchange, routing keys: `wearables.alert.critical/batch/readings.synced`); `WearablesAlertConsumer` (critical → SMS to `WEARABLES_ALERT_SMS_TO` + portal notification; batch → portal notification); `WearablesFhirConsumer` (idempotent FHIR R4 Observation export, concurrent-safe, never deletes fhir-linked rows). New endpoints: `physicianView`, `setThresholds`, notifications bell. Web: physician admin page `app/admin/patients/[patientToken]/wearables/page.tsx` (AdminAuthProvider/Bearer token); alert bell with unread badge in `WearablesTab`.
- **W6** — OAuth token rotation (`adapter.refreshToken` interface + MockAdapter impl); Garmin webhook HMAC-SHA1 + 100/min sliding-window rate-limit (`webhooks/garmin.webhook.controller.ts`); physician scope hardening: `assertPhysicianAccess` requires `TelehealthSession` within `WEARABLES_PHYSICIAN_ACCESS_WINDOW_DAYS` **or** explicit `physician_named_access` consent plus `physician_sharing`. Docs: `docs/DPIA_WEARABLES_ADDENDUM.md`; `RETENTION.md` wearables schedule; `LAUNCH_CHECKLIST.md` §L9 compliance gate.

**Key architectural decisions baked in (don't re-litigate):** no `physicians` table → critical SMS goes to `WEARABLES_ALERT_SMS_TO` escalation number; physician identity resolved through `TelehealthSession.physicianId`. OAuth state is in-memory HMAC store (Redis = prod scale-out, documented as TODO). `WEARABLES_ENABLED` **must stay `false`** until L9 checklist passes (DPO sign-off + legal + security review). Real W2/W3 adapters are still required before switching to `WEARABLES_PROVIDER=live`. Webhook receipts are audited; no separate `webhook_log` table. Batch-alert digest is per-message; 30-day consent-grace suspension + retention purge crons are documented in `RETENTION.md` but not yet implemented.

## Conventions
- Replace prototype `DB.*` (localStorage) with API/CMS calls.
- Keep the prototype's component vocabulary (cards, badges, chips, status colours).
- Patient data: FHIR R4 (Condition/MedicationRequest/Observation); never commit real patient records.
- One sprint at a time. Commit after each. Report Done-when criteria before proceeding.
- **API tests are `*.test.ts`, not `.spec.ts`** — Jest `testRegex` is `.*\.test\.ts$` (`apps/api/jest.config.js`). Sprint backlogs sometimes say `.spec.ts`; use `.test.ts` or the test won't run. Place under `<module>/__tests__/`.
- **Prisma columns are snake_case, fields are camelCase** — bridge with `@map`/`@@map` (e.g. `patientToken String @map("patient_token")`, `@@map("wearable_devices")`). Use `@db.Timestamptz`, `@db.Uuid`, `@db.Decimal(12,4)` to match SQL types.
- **Physician/clinician IDs are opaque `TEXT`** (`physicianId`, `set_by_physician_id`) — there is **no `physicians` table** in the Prisma schema; do not add FKs to one.
- **Patient endpoints** authenticate via the `x-patient-session` JWT header (verified with `jose`, `sub` = `patient_token`); **staff endpoints** use `AuthGuard('jwt')` (passport). Don't mix the two.
- Known-flaky/expected-skip tests in CI without full infra: booking date tests (timezone-sensitive), telehealth/LiveKit and `*.e2e`/`*.db` suites (need `@nestjs/platform-express` / a live DB). These are not blockers — confirm a failure is pre-existing (e.g. `git stash` your change) before chasing it.
