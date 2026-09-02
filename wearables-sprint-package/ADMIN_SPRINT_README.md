# Admin Backend Sprint Package — Nemocnica Snina
## Production wiring for the CMS, staff auth, RBAC, audit log & GDPR tools

---

## Sprint sequence

```
A1 — Strapi content types + NestJS API + physician profiles
  │   (replaces localStorage prototype; adds individual /lekari/[slug] pages)
  │
A2 — Staff auth + MFA + RBAC + Super Admin user management
  │   (replaces prototype password; adds staff accounts, scopes, invite/reset flows)
  │
A3 — Audit log hardening + GDPR data tools + translation review gate
      (append-only DB; patient export/erasure; CS/PL/HU/UK translation gating; WCAG sweep)
```

A1 → A2 → A3 must run in order. Do not combine sprints.

---

## Contents

| File | Purpose |
|---|---|
| `SPRINT_A1_API_WIRING.md` | Strapi 4 content types · NestJS CMS + public API · physician profiles |
| `SPRINT_A2_AUTH_RBAC.md` | Staff auth · TOTP MFA · RBAC · Super Admin user management module |
| `SPRINT_A3_AUDIT_GDPR_I18N.md` | Audit log hardening · GDPR tools · translation review gate · WCAG |

---

## How to use each sprint file

1. Start a new Claude Code session in the repo root.
2. Paste the contents of the `## Paste this into Claude Code before starting` block at the top of the sprint file as your first message.
3. After it acknowledges the files, paste the full sprint text.
4. After each sprint: review the **Done when** checklist before merging and proceeding.

---

## What the prototype admin covers (design source of truth)

| File | Role |
|---|---|
| `admin.html` | Full CMS shell — list, editor, singleton, telehealth, tools views |
| `assets/admin.js` | `SCHEMAS` (7 collections) + `SINGLETONS` (2) — exact field definitions |
| `assets/data.js` | `SEED` (version 8) — real hospital data, bilingual field shapes |
| `Admin User Guide.html` | 19-section staff handbook — roles, booking rules, translations |

**The Strapi content types in A1 must exactly match `ADMIN.SCHEMAS` in `assets/admin.js`.** Do not invent new field names. The `SEED` in `assets/data.js` is the canonical seed data.

---

## Role hierarchy

| Role | Who | Access |
|---|---|---|
| `super_admin` | IT admin / system owner | Everything, including user management, GDPR erasure, content reset |
| `administrator` | Hospital manager | Everything except user management modification and GDPR erasure |
| `clinician` | Department head / physician | CMS edit for own department/clinic/physician record; patient onboarding queue; wearable threshold editor |
| `editor` | Communications / admin staff | CMS edit for assigned scope (news, disclosures, general content) |

**Access scopes** (A2) narrow any role below `administrator` to specific department, clinic, physician, or facility records. An editor with no scope rows has full collection access for their role. An editor with scope rows `[department:chirurgia]` can only edit records linked to that department.

---

## Super Admin user management — key capabilities

Implemented in Sprint A2 (`/api/admin/users/` + Users UI in `admin.html`):

| Capability | Notes |
|---|---|
| List all staff accounts | Name, email, role, status, MFA status, last login |
| Create account | Name + email + role + optional access scopes → invite email sent |
| Edit account | Name, role, status, scopes |
| Disable account | All sessions revoked immediately |
| Delete account (soft) | Anonymised; audit history preserved |
| Re-send invite | Rate-limited 3/hour; 72-hour token |
| Reset password | Rate-limited 3/hour; 30-min token; email sent |
| Reset MFA | Clears TOTP; forces re-setup on next login; all sessions revoked |
| Revoke all sessions | Immediate Redis blacklist; email notification sent to user |
| Manage access scopes | Replace scope list atomically; takes effect within 15 min (access token TTL) or immediately after session revoke |

---

## Physician profile pages (A1 gap fix)

The prototype `lekari.html` links physicians to their department or clinic — there are no individual profile pages. Sprint A1 adds:

- `GET /api/public/physicians/:slug` — individual physician API
- `apps/web/src/app/[lang]/lekari/[slug]/page.tsx` — SSR profile page
- Photo upload in physician editor (Strapi media)
- Canonical URL per physician for SEO and sharing
- `generateStaticParams` for all published physicians
- Breadcrumb: Home / Physicians / MUDr. Jana Borščová

---

## Non-negotiables (shared across all admin sprints)

- `MFA_REQUIRED=true` in production. No bypass.
- Staff JWT (`aud: ns.staff`) is never accepted on patient endpoints.
- Access scopes enforced server-side. Client UI is cosmetic only.
- `audit_log` is append-only at DB layer (trigger + REVOKE). Never delete entries.
- Machine-translated clinical content (CS/PL/HU/UK) requires human review before publish.
- GDPR erasure preserves FHIR Observations (legally required, Act 362/2011).
- `CMS_AUTH_BYPASS=true` accepted only in dev; config validator rejects in production.
- EU hosting only (Decree 179/2020). GDPR export files must not transit outside EU.
- axe WCAG 2.1 AA: zero critical/serious on all routes before any sprint is marked done.
