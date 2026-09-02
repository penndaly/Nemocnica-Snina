# CLAUDE.md — Nemocnica Snina production repo

Project instructions for Claude Code. Drop this at the repo root.

## What this is
Production build of the Nemocnica Snina (Snina Hospital) platform: a bilingual→multilingual public website + admin CMS + patient services (booking, onboarding, portal) + telemedicine module. The `design_handoff_nemocnica_snina/` folder is the **design + content source of truth**.

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

## Local fixes already applied (commit before sprinting)
```bash
git add -A && git commit -m "fix: local dev setup — auth, HIS queue, tsconfig, i18n, SkipLink"
```

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

## Conventions
- Replace prototype `DB.*` (localStorage) with API/CMS calls.
- Keep the prototype's component vocabulary (cards, badges, chips, status colours).
- Patient data: FHIR R4 (Condition/MedicationRequest/Observation); never commit real patient records.
- One sprint at a time. Commit after each. Report Done-when criteria before proceeding.
