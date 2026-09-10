# SPRINT ROUTE-1a — `kariera` + `edukacia` routes

**Status:** ready to run · **Owner:** Claude Code · **Base:** `main`
**Branch:** `feat/route-kariera-edukacia` · **Authored:** 2026-09-10
**Source of truth:** `design_handoff_nemocnica_snina/kariera.html`, `edukacia.html`,
`assets/data.js` (`SEED`), `assets/media.js` (slot plan)
**Prerequisite:** UI-1 and UI-1a merged (hero + grouped nav must exist).

First two of the four missing public routes found in the ROUTE-1 inventory. Both are
display-only content pages — **except** the careers apply flow, which is a real form
handling personal data and is the bulk of this sprint's risk.

**One sprint per turn. Commit after each task. Report Done-when before proceeding.**

---

## Task 1 — `/[lang]/edukacia`

Patient education library: ~20 articles across 6 categories, single data shape,
display-only.

- Add `EducationArticle` to `packages/types` `Seed`: `id, slug, category, title{sk,en},
  excerpt{sk,en}, body{sk,en}, readingMinutes, updatedAt`. Category is an enum, not a
  free string.
- `strapi-client.ts` fallback getter, matching the existing pattern.
- Route renders: `<PageHero slot="education-hero">`, category filter chips, article
  cards. Detail route `/[lang]/edukacia/[slug]`.
- Machine-translated clinical content stays a **draft** — the existing lifecycle hook
  applies here; education articles are clinical content.
- Article images use `<HospitalImage>`; no slot in the plan → `education` scene art.

**Done when:** both routes render from CMS with seed fallback; category filter is
server-rendered (works with JS off); axe clean; sk/en complete; nav leaf added to the
`care` group (see Task 3).

---

## Task 2 — `/[lang]/kariera` + apply flow

### 2a. Content
- `JobPosting` in `Seed`: `id, slug, title{sk,en}, department, employmentType,
  salaryFrom, postedAt, closesAt, requirements{sk,en}[], contactEmail`.
- Benefits list and HR contact from `SEED`. Hero slot `careers-hero`.
- Route + detail route `/[lang]/kariera/[slug]`.

### 2b. Apply flow — treat as a personal-data surface

A CV upload is personal data under GDPR. This form carries most of the same obligations
as patient data, minus FHIR. Do not build it as a plain contact form.

**Server-side, non-negotiable:**
- Validation is **server-side**; a forged POST must be rejected. Client validation is cosmetic.
- Rate-limit by IP and by email. Applications are a spam target.
- **File upload:** PDF/DOC/DOCX only, sniffed by content type, not extension. Max 10 MB.
  Virus-scan before storage. Reject anything that fails, with a generic error.
- **Storage EU-resident only** (Decree 179/2020) — same S3-compatible EU bucket policy as
  the rest of the platform, AES-256 at rest, TLS 1.3 in transit. Never the public bucket.
- **Explicit consent checkbox**, unticked by default, with a link to the retention notice.
  Store consent timestamp and the notice version shown.
- **Retention:** default 6 months from submission, then automatic deletion of the file
  and the personal fields. Applicant can withdraw at any time via a signed link; withdrawal
  deletes the file and is audited. Confirm the 6-month figure with the DPO before merge —
  if unconfirmed, make it config, not a literal.
- **Audit log** every submission, download, and deletion — append-only, same as everywhere
  else. HR downloading a CV is a personal-data access and must be logged.
- Applications visible only to an HR role in admin. RBAC, MFA — no bypass.
- No applicant name, email, or filename in any log line, error message, or metric label.

**Done when:** a forged POST with a `.exe` renamed to `.pdf` is rejected server-side;
consent is required and recorded; retention job deletes on schedule and the deletion is
audited; the CV is unreachable without an authenticated HR session; E2E covers submit,
reject-bad-file, withdraw; axe clean on the form including error states.

**If the DPO sign-off for CV retention is not in hand, ship 2a and hold 2b.** A careers
page with an email address is an acceptable demo state; an unapproved personal-data
store is not.

---

## Task 3 — Nav restoration (per-sprint, not deferred)

Add the leaves as each route lands, so the nav never advertises a 404 and never hides a
shipped page:
- `edukacia` → **care** group, after `services`.
  sk "Edukácia pacientov" / en "Patient education";
  description sk "Články a rady pre pacientov" / en "Articles and patient guidance".
- `kariera` → **hospital** group, after `news`.
  sk "Kariéra" / en "Careers";
  description sk "Voľné pracovné miesta" / en "Open positions".

Update the mobile grouped menu and the footer link list to match. Update the nav E2E test.

**Check the 1100px breakpoint still holds** — the group panels grow by one row each,
which does not affect the top bar, but re-run the no-horizontal-scroll assertion at the
full viewport ladder anyway.

---

## Task 4 — Apply the deferred grid item

`.stat-strip` is not ported yet, but if this sprint ports any multi-column stat or card
strip, bring `GRID_AUDIT_NARROW_VIEWPORT.md` item 1 with it: collapse to `1fr` at 480px.
Any new grid in these two routes must clear 320px before the sprint closes.

---

## Out of scope
`pre-pacientov` (ROUTE-1b) and `o-nemocnici` (ROUTE-1c) — both need substantial new
`Seed` shapes and are sized separately. IMG-1, STG-1.

## Non-negotiables
- WCAG 2.1 AA, axe zero critical/serious (Act 351/2022).
- Every image `alt` in sk **and** en via i18n keys; decorative → `alt=""`.
- Booking-style rule: anything enforced only client-side is a bug.
- Audit log append-only at the DB layer.
- EU hosting only. No secret value in any commit, log, or report.
- Hero copy cap and vertical-scrim breakpoint stay complementary (UI-1a invariant) —
  both new heroes must clear 4.5:1 at 781 / 900 / 1024 / 1100 / 1440px.
