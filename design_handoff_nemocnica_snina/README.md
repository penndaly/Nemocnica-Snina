# Handoff: Nemocnica Snina — Public Website + Admin CMS

## Overview
This package is the **design + UX + content source of truth** for the Nemocnica Snina (Snina Hospital) digital platform: a bilingual (SK/EN, expandable to 6 languages) public website plus an admin CMS that lets non-technical staff add/edit/replace all content (departments, clinics, physicians, services, facilities, news, public disclosures, page content).

It also includes patient-facing modules: a rule-aware appointment booking flow and a secure patient portal (records, e-prescriptions, lab results).

> **Read this first:** The HTML/CSS/JS files in this bundle are **design references**, not production code to ship. They are a fully interactive, high-fidelity prototype whose "backend" is an in-browser `localStorage` store. Your task in Claude Code is to **recreate these designs and behaviors in a real production stack** (recommended in `PRODUCTION_ARCHITECTURE.md`), using the prototype as the canonical reference for layout, styling, copy, content model, and interaction logic. The prototype is intentionally framework-light so it reads cleanly as a spec.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, components, copy (in Slovak + English) and interactions are all settled. Recreate the UI faithfully. Exact tokens are in the **Design Tokens** section and in `assets/styles.css`.

## How to use this bundle in Claude Code
**If the scaffold is already built (Phases 0–9 complete), go to `COMPLETION_BRIEF.md`** — it covers the production-hardening → go-live work: server-side rule proofs, audit immutability, GDPR DSAR/erasure, Strapi connection, eID/OIDC + HIS sync, payments, 6-language rollout, and pen-test/launch, sequenced and paste-ready with decisions locked.

**For a fresh build, start with `BUILD_GUIDE.md`** — a step-by-step, paste-ready prompt sequence that builds the **entire product** (full scope of the planning documents: public site, CMS, scheduling, eDohody onboarding, patient portal/FHIR, HIS/NCZI/e-VÚC/SMS/payment integrations, security, accessibility, 6-language rollout, testing & launch). Work through it in order.

The other files are the references the guide points at:
1. This README — per-screen UI spec + design tokens + components.
2. `PRODUCTION_ARCHITECTURE.md` — stack, integrations, compliance, phasing.
3. `DATA_MODEL.md` — collections, fields, types, relationships (the build contract).
4. `assets/data.js` — the **complete real bilingual content** to seed the CMS/DB.
5. `assets/styles.css` — the design-token dictionary to port into your theme.
6. `CLAUDE.md` — drop at the production repo root as project rules.

The HTML files show intended look/behavior; recreate them in the production stack (do not ship the prototype).

---

## Information architecture (routes)
| Prototype file | Purpose | Production route (suggested) |
|---|---|---|
| `index.html` | Home: hero, emergency card, quick access, accepting-new-patients, featured departments, news + APS | `/[lang]` |
| `oddelenia.html` | Inpatient departments list | `/[lang]/oddelenia` |
| `oddelenie.html?id=` | Department detail | `/[lang]/oddelenia/[slug]` |
| `ambulancie.html` | Outpatient clinics (schedules, booking rules, status) | `/[lang]/ambulancie` |
| `lekari.html` | Physician directory (search + accepting filter) | `/[lang]/lekari` |
| `sluzby.html` | Services & clinical practices | `/[lang]/sluzby` |
| `diagnostika.html` | Diagnostics & support facilities (SVaLZ) | `/[lang]/diagnostika` |
| `aktuality.html` | News & announcements | `/[lang]/aktuality` |
| `zverejnovanie.html` | Public disclosures (contracts & invoices) | `/[lang]/zverejnovanie` |
| `kontakt.html` | Contact, about, GDPR & accessibility statements | `/[lang]/kontakt` |
| `objednanie.html` | Appointment booking wizard (clinic-rule aware) | `/[lang]/objednanie` |
| `portal.html` | Patient portal (login, records, meds, labs) | `/[lang]/portal` |
| `admin.html` | Admin CMS (login + CRUD for every collection) | `/admin` (protected) |

Shared chrome (header, utility bar, language switch, footer) is rendered by `assets/site.js` → `Site.mount()`. UI strings live in `STR`; icons in `ICON`.

---

## Screens / Views

### Global chrome (`assets/site.js`)
- **Utility bar** (`.utility-bar`, bg `--blue-900`, text `#d6e2f0`, min-height 38px): left = switchboard phone + emergency "112" link (emergency in `#ffb3aa`, bold); right = SK/EN language switch (`.lang-switch`, active pill `--blue-600`).
- **Header** (`.site-header`, sticky, `rgba(250,246,240,.92)` + 10px blur, bottom border `--line`): brand mark (44px, `--blue-700`, 11px radius, white "medical cross" SVG) + brand text (name in Newsreader 1.22rem `--blue-900`, subtitle uppercase .72rem `--ink-3`). Primary nav (7 links, weight 600, active = `--blue-50`/`--blue-700`). CTAs: "Patient portal" (ghost) + "Book appointment" (primary). Collapses to a hamburger + slide-down `.mobile-menu` below 940px.
- **Footer** (`.site-footer`, bg `--blue-900`): 4-column grid (brand+address / Care / For patients / Mandatory information) + bottom bar with copyright and "WCAG 2.1 AA · Act No. 351/2022".

### Home (`index.html`)
- **Hero** (`.hero-wrap`): 2-col grid (1.35fr / .9fr). Left: terracotta eyebrow badge, H1 (Newsreader), lede, two CTAs (primary "Book", ghost "Find a physician"), trust chips. Right: **emergency card** (`.emergency-card`, white, 5px top border `--red`, shadow-lg) with red "112" button and rows for switchboard / central reception / pharmacy.
- **Quick access**: 3 cards (`.qa`) linking to Departments / Clinics / Physicians; icon tile `--blue-50`/`--blue-700`, arrow that nudges on hover.
- **Accepting new patients**: warm band (`--bg-2`), 3 physician cards with avatar (initials), bio, green "Accepting new patients" badge.
- **Featured departments**: 3 cards with 16:9 placeholder, terracotta icon tile, summary, head + beds chip.
- **News + APS**: 2-col; news list (badge per type: good=green, info=blue, alert=amber) + APS sidebar card (4px top border `--blue-600`).

### Departments list / detail (`oddelenia.html`, `oddelenie.html`)
- List: 3-col card grid; each card = 16:9 placeholder, terracotta dept icon, short name, summary, beds chip (or "Outpatient"), head physician.
- Detail: page hero with dept icon (58px terracotta tile) + name + summary + chips. Body = 2-col (1.6fr/.9fr): left = 16:9 placeholder, "About", facilities checklist (2-col, green checks), related physicians (avatar mini-cards); right = sticky contact card (4px top border `--blue-600`) with phone/email/lead/deputy/visiting hours + "Book" and "How to find us" buttons.

### Clinics (`ambulancie.html`)
- Legend of 4 status badges. Each clinic = card split 1.7fr/.9fr: left (white) = specialty eyebrow, status badge, name, doctor/nurse, location + phone + referral chips, blue **rule note** callout, optional fee; right (`--bg-2`, left border) = "Operating hours" with clock icon + dashed schedule rows + "Book here" (primary) **or** disabled "Online booking unavailable" depending on `bookable`.

### Physician directory (`lekari.html`)
- Toolbar: search box (icon-prefixed) + "Only accepting new patients" checkbox (green accent). 3-col cards: large avatar (initials), name, role, accepting/not-accepting badge, bio, language tags (`.lang-tag`, blue), link to dept/clinic. Empty state message.

### Services (`sluzby.html`)
- 2-col cards: 54px blue icon tile + name + description + contextual "View department/clinic/diagnostics" link. Closes with a dark blue CTA band (`.band-blue`) + terracotta "Book" button.

### Diagnostics (`diagnostika.html`)
- Horizontal cards (120px icon rail on `--bg-2` / body): kind eyebrow, phone chip, name, lead, description, feature chips (green checks). Covers Lab Medicine, Radiodiagnostics, Central Reception, Pharmacy.

### News (`aktuality.html`)
- Narrow column of article cards (badge + date; alert type gets left border `--amber`). Deep-linkable via `#id` (highlights target).

### Public disclosures (`zverejnovanie.html`)
- Toolbar: search + type filter buttons (All / Contracts / Invoices). Data table (`table.data`): ID, Type badge, Partner, Value, Date, PDF download link. Hover row = `--blue-50`.

### Contact / about (`kontakt.html`)
- Page hero = About title + body. 2-col: left = 16:9 map placeholder, "Where to find us" mini contact cards (address/switchboard/reception/pharmacy), APS block (red left border); right = sticky quick-contact card. Warm band below with **GDPR** (`#gdpr`) and **Accessibility** (`#pristupnost`) cards (footer links anchor here).

### Booking wizard (`objednanie.html`)
- 5-step stepper (Clinic → Date → Time → Details → Confirm) with done/active states. Step 1 lists bookable clinics (referral chip if required). Step 2 generates the **next 8 dates that match the clinic's `bookingDays`** and shows the clinic's booking rule. Step 3 = time-slot grid (per-clinic slot sets). Step 4 = patient form with conditional referral consent + mandatory GDPR consent. Step 5 = confirmation card with generated booking ID. Accepts `?clinic=<id>` to deep-link into step 2.
- **Business rules to preserve** (from the audit): Trauma surgery books Tue/Thu only; Angiology books only Thu/Fri 13:00–14:00 and requires a referral; Diabetology/Neurology not bookable (closed/temporary); General surgery has 24/7 APS + €1.99 LSPP fee.

### Patient portal (`portal.html`)
- Login card (blue header, ID + PIN/SMS) — demo accepts anything; persists in `sessionStorage`. Dashboard = profile header + left nav (Overview / Health records / e-Prescriptions / Lab results) + content. Records map to FHIR resource names (Condition, MedicationRequest, Observation) — see architecture doc for real FHIR integration.

### Admin CMS (`admin.html` + `assets/admin.js`)
- Login (password `admin` in prototype — replace with real auth/MFA). Dark sidebar: **Content** collections (with live counts), **Settings** singletons (Hospital info, Page content), **Tools** (Export JSON / Import JSON / Reset to defaults).
- **List view** per collection: rows with icon, title, subtitle, status/feature badge, edit + delete icon buttons, "Add new".
- **Editor**: schema-driven form. Bilingual fields render **side-by-side SK / EN** inputs (`.bil`); also booleans (switches), selects, references to other collections (dropdowns), bilingual lists (newline-per-item textareas), tags (CSV), number, date. Save writes through the store and reflects on the public site immediately. New items get an auto-slugged `id`.
- This editor's `SCHEMAS`/`SINGLETONS` (`assets/admin.js`) are effectively the **CMS collection definitions** — port them 1:1 to your headless CMS.

---

## Interactions & Behavior
- **Language**: `getLang()/setLang()` persist `ns_lang` in `localStorage`; switching reloads and re-renders. In production use locale-prefixed routes + `hreflang` (see architecture doc). `L(field)` resolves a `{sk,en}` object to the active language.
- **Data store**: `DB` (`assets/data.js`) seeds from `SEED` on first load / version bump (`SEED_VERSION`), persists to `localStorage` key `ns_db_v1`. CRUD: `get/list/find/save/upsert/remove/reset/export/import`. **This is the prototype's stand-in for the real API + database.**
- **Reveal**: entrance animation removed — content is always visible (do not reintroduce hide-until-scroll; it risks hidden content for SSR/no-JS/print).
- **Forms**: booking + portal forms validate natively (required); GDPR consent mandatory; referral consent conditional on clinic.
- **Responsive**: nav collapses < 940px; multi-col grids collapse to 1 col < 620–780px; sticky sidebars become static on mobile.
- **Accessibility**: keyboard-operable, semantic headings, sufficient contrast, `lang` attribute set. Target WCAG 2.1 AA (legal requirement — Act 351/2022).

## State Management (prototype → production)
| Prototype state | Production equivalent |
|---|---|
| `ns_lang` (localStorage) | locale route segment + i18n provider |
| `ns_db_v1` (localStorage via `DB`) | PostgreSQL via API; content via headless CMS |
| `ns_portal` (sessionStorage) | authenticated patient session (OIDC / national eID) |
| `ns_admin_auth` (sessionStorage, pw `admin`) | admin auth with **MFA** (mandatory per cybersecurity decree) |
| Booking wizard `state` object | server-validated booking with availability locking + SMS token |

---

## Design Tokens
All defined as CSS variables in `assets/styles.css` (`:root`).

**Color — medical blue (trust)**
`--blue-900 #14375f` · `--blue-800 #1a4577` · `--blue-700 #1e5290` (primary) · `--blue-600 #2563a8` · `--blue-500 #3a7cc0` · `--blue-200 #b9d2ea` · `--blue-100 #dce8f4` · `--blue-50 #eef4fa`

**Color — warm neutrals (human)**
`--bg #faf6f0` (page) · `--bg-2 #f4ede2` (band) · `--surface #ffffff` · `--warm-100 #f3ece1` · `--warm-200 #e8dccb` · `--line #e7ddcf` · `--line-2 #d8cbb6`

**Color — warm ink**
`--ink #2c2820` · `--ink-2 #5b5347` · `--ink-3 #8a8073`

**Color — accents**
`--terra #c06a38` (terracotta, secondary highlight, +`--terra-50 #f8ece3`) · `--green #2f8a64` (accepting/open/success, +`--green-50 #e6f2ec`) · `--amber #c08a2e` (caution/limited, +`--amber-50 #f7efdc`) · `--red #c0392b` (emergency, +`--red-50 #f8e9e7`)

**Typography**
- Headings/display: **Newsreader** (Google Fonts), weights 400–700, `letter-spacing -0.01em`, `line-height 1.12`.
- Body/UI: **Mulish** (Google Fonts), weights 400–800.
- Base body 17px / line-height 1.6. `h1` clamp(2.2rem, 4.5vw, 3.5rem); `h2` clamp(1.7rem, 3vw, 2.4rem); `h3` 1.35rem; `h4` 1.1rem (Mulish 700). Eyebrow: Mulish 700, .76rem, uppercase, `letter-spacing .14em`, `--blue-600` (or `.terra`).

**Radius**: `--radius 14px` · `--radius-sm 9px` · `--radius-lg 22px`. Pills/badges 999px.
**Shadow**: `--shadow-sm`, `--shadow`, `--shadow-lg` (see file for exact values; all warm/blue-tinted).
**Layout**: container max-width 1180px; padding 0 24px; header height 76px.
**Breakpoints**: 940px (nav + 3/4-col → 2-col), 780px (clinic/facility splits → 1-col), 620px (everything → 1-col, denser).
**Motion**: respect `prefers-reduced-motion`; transitions ~.14–.18s on interactive elements; no infinite loops.

## Components (reusable, in `assets/styles.css`)
`.btn` (+`-primary/-terra/-ghost/-emergency/-sm/-lg/-block`), `.card` (+`-pad/-hover`), `.badge` (+`-green/-amber/-red/-blue/-terra/-gray` with `.dot`), `.chip`, `table.data`, form controls (`label.field`, inputs/selects/textarea with blue focus ring), `.ph` image placeholder (warm diagonal stripes + monospace `data-label`), `.avatar`/`.avatar-lg` (initials), `.eyebrow`, `.lede`, grid/flex utilities. Icons are inline-SVG strings in `ICON` (`assets/site.js`) — replace with your icon library (lucide-react matches the visual style; original prototypes used `lucide-react`).

## Assets
- **Fonts**: Newsreader + Mulish via Google Fonts (`@import` in `styles.css`).
- **Icons**: inline SVG set in `assets/site.js` (`ICON`), stroke style ≈ Lucide. Use `lucide-react` (or equivalent) in production.
- **Images**: none yet — all imagery is labeled `.ph` placeholders (department photos, facility/map). Wire these to CMS media fields; copy includes Slovak/English labels describing each intended shot.
- No Anthropic brand assets are used.

## Files in this bundle
- `BUILD_GUIDE.md` — prompt-by-prompt build playbook for the full product (fresh build)
- `COMPLETION_BRIEF.md` — production-hardening → go-live brief (after the scaffold is built)
- `PUNCHLIST.md` — final go-live brief: 7 remaining tasks, one-task-per-turn, paste-ready
- `CONFIG_AND_ENV.md` — every env var + external account, `.env.example`, secret-handling rules
- `E2E_TEST_SPECS.md` — Playwright specs for booking / onboarding / portal / i18n / a11y / CMS
- `index.html`, `oddelenia.html`, `oddelenie.html`, `ambulancie.html`, `lekari.html`, `sluzby.html`, `diagnostika.html`, `aktuality.html`, `zverejnovanie.html`, `kontakt.html`, `objednanie.html`, `portal.html`, `admin.html`
- `assets/styles.css` — design system / tokens
- `assets/data.js` — **content model + full bilingual seed data + store API**
- `assets/site.js` — i18n, icons, shared header/footer chrome
- `assets/admin.js` — CMS schemas (collection definitions) + auth/helpers
- `PRODUCTION_ARCHITECTURE.md` — recommended stack, integrations, phases
- `DATA_MODEL.md` — collections, fields, types, relationships (DB + CMS)
- `CLAUDE.md` — drop-in project instructions for the production repo
```
