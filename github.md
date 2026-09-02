repo: penndaly/Nemocnica-Snina
branch: main

## Last sync
date: 2026-08-24T07:36:19Z
- Connected repo for read/reference; confirmed it mirrors this project's `design_handoff_nemocnica_snina/` design source plus the full production monorepo (apps/web, apps/api, apps/cms, packages/ui, packages/types, infra, docs).
- Repo's `design_handoff_nemocnica_snina/` is BEHIND this project: it has the original 11 public pages + portal/admin but not the 4 new patient-facing pages built this session (`pre-pacientov.html`, `o-nemocnici.html`, `kariera.html`, `edukacia.html`) or the updated `assets/data.js` / `site.js` / `styles.css`. These need to be pushed to the repo by the dev workflow before Claude Code sprints can build against them.
- Flagged for the user: a Firebase project config (`snina-nemocnica`, apiKey/analytics) was shared in chat. This doesn't match the repo's documented stack (Next.js 15 + NestJS + Strapi 4 + PostgreSQL, EU-only hosting per CLAUDE.md non-negotiables) — needs clarification before treating it as authoritative (e.g. is it a separate analytics/hosting concern, or a stack change?).

## Screen map
| Screen / page | Repo files |
|---|---|
| Public site (11 pages) | `design_handoff_nemocnica_snina/*.html` |
| Admin CMS prototype | `design_handoff_nemocnica_snina/admin.html` |
| Patient portal prototype | `design_handoff_nemocnica_snina/portal.html` |
| Production web app | `apps/web/` (Next.js, App Router, locale-prefixed routes) |
| Production API | `apps/api/` (NestJS + Fastify) |
| CMS | `apps/cms/` (Strapi 4) |
| Shared UI / design tokens | `packages/ui/` |
| Shared types | `packages/types/` |
| Infra | `infra/` (docker-compose, nginx, postgres) |
| Compliance docs | `docs/` (DPIA, MDR scope, NIS2, retention) |
