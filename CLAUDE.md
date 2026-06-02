# CLAUDE.md — Nemocnica Snina production repo

Project instructions for Claude Code. Drop this at the repo root.

## What this is
Production build of the Nemocnica Snina (Snina Hospital) platform: a bilingual→multilingual public website + admin CMS + patient services (booking, onboarding, portal). The `design_handoff_nemocnica_snina/` folder is the **design + content source of truth** (high-fidelity HTML prototype). Recreate it in the production stack — do not ship the prototype.

## Sources of truth
- **UI / UX / copy / tokens:** the HTML files + `assets/styles.css` in the handoff bundle.
- **Content model + seed data:** `assets/data.js` (`SEED`) → see `DATA_MODEL.md`.
- **CMS collections:** `assets/admin.js` (`SCHEMAS`/`SINGLETONS`).
- **Architecture / integrations / compliance:** `PRODUCTION_ARCHITECTURE.md`.

## Stack (see architecture doc for rationale)
- Next.js (App Router) + React + TypeScript, locale-prefixed routes (`/[lang]/…`), SSR/SSG.
- Headless CMS (Strapi or Drupal) for all public content.
- API: NestJS or Laravel. DB: PostgreSQL + Redis. EU hosting.
- Icons: `lucide-react` (matches prototype). Port design tokens into the styling system.

## Non-negotiables
- **i18n:** locale-prefixed URLs + reciprocal `hreflang`; never IP/cookie redirection. Bilingual data shape `{sk,en,…}` extends to `{sk,cs,pl,hu,uk,en}`.
- **Accessibility:** WCAG 2.1 AA (legal — Act 351/2022). Keyboard, screen-reader, contrast, ARIA on forms.
- **Security:** GDPR + Act 18/2018; Decree 179/2020 (TLS 1.3, AES-256 at rest, **MFA for admin/clinicians**, immutable audit log). Minimise data on the web tier; clinical detail stays in HIS.
- **Booking rules must be enforced server-side** (clinic-specific weekdays/windows, referral requirement, closed/temporary status) — see `clinics` in `DATA_MODEL.md`.
- **HIS writes go through an async queue** (RabbitMQ) → sync agent → HL7/FHIR. No direct web→HIS DB writes.

## Conventions
- Replace prototype `DB.*` (localStorage) with API/CMS calls.
- Keep the prototype's component vocabulary (cards, badges, chips, status colours) and token names where practical.
- Patient data: integrate FHIR R4 (Condition/MedicationRequest/Observation); never commit real patient records.
