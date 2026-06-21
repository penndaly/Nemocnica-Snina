# Sprint S5 — Hardening & Verification Report

**Date:** 2026-06-21  
**Branch:** main  
**Auditor:** Claude Code (automated verification pass)

---

## Scope

Seven items from `SPRINT_BACKLOG.md §Sprint S5` were verified against the prototype HTML files
in `design_handoff_nemocnica_snina 5/` and the live production code under `apps/web/src/`.

---

## Item 1 — Home Page Sections (`index.html` → `apps/web/src/app/[lang]/page.tsx`)

| Sub-item | Status | Notes |
|---|---|---|
| (a) Emergency card | ✓ Confirmed | Phone numbers from Hospital singleton; 112 `tel:` link present; red top-border card |
| (b) Quick access | ✓ Confirmed | 3 cards → `/oddelenia`, `/ambulancie`, `/lekari`; `card-hover` + `<ArrowRight>` icon |
| (c) Accepting new patients | **Fixed** | Was missing `physician.bio` text and link to physician profile. Fixed: cards now render `physician.bio` and are wrapped in `<Link href="/${locale}/lekari#${physician.id}">` matching prototype `<a href="lekari.html#${p.id}">` |
| (d) Featured departments | ✓ Confirmed | 3 `featured=true` cards; 16:9 `.ph` placeholder; beds chip; linked to `/oddelenia/${dept.id}` |
| (e) News + APS | ✓ Confirmed | `good→badge-green`, `info→badge-blue`, `alert→badge-amber` + amber left border; APS sidebar card with `--blue-600` top border |

---

## Item 2 — Department Detail (`oddelenie.html` → `apps/web/src/app/[lang]/oddelenia/[slug]/page.tsx`)

| Sub-item | Status | Notes |
|---|---|---|
| (a) Facilities checklist | ✓ Confirmed | 2-col grid with `<Check>` green icon per item; renders from `dept.facilities[]` |
| (b) Related physicians | ✓ Confirmed | Avatar mini-cards with accepting badge; filtered by `physician.dept === dept.id` |
| (c) Sticky contact card | **Fixed** | Card already had `position: sticky` for desktop. **Added** CSS utility classes `.detail-grid` / `.detail-sidebar` in `globals.css` with `@media (max-width: 940px)` rules: grid collapses to 1 column, sidebar becomes `position: static`. Applied classes to the layout wrappers. |

---

## Item 3 — Physician Directory (`lekari.html` → `apps/web/src/app/[lang]/lekari/page.tsx`)

| Sub-item | Status | Notes |
|---|---|---|
| (a) Language tags | ✓ Confirmed | `.lang-tag` chips rendered from `physician.langs[]` on each card |
| (b) Language filter | **Added** | Prototype HTML has no language filter; S5 spec explicitly requires one. Added a chip set above the grid: "All" + one chip per unique language derived from loaded physicians. Filters in real-time; `aria-pressed` state; resets to null on re-click |
| (c) Empty state | ✓ Confirmed | "Žiadny lekár nezodpovedá hľadaniu." / "No physicians match your search." shown when `filtered.length === 0` |

---

## Item 4 — News Deep-link (`aktuality.html` → `apps/web/src/app/[lang]/aktuality/page.tsx`)

| Status | Notes |
|---|---|
| **Fixed** | `aktuality/page.tsx` is a server component with `id={item.id}` on each `<article>` (browser auto-scrolls to the anchor). **Added** `<NewsHashHighlight />` client component: on mount it reads `location.hash`, applies `outline: 2px solid var(--blue-500)` + `outlineOffset: 4px` to the target article (matching prototype), scrolls it into view, then removes the outline after 2 s. |

---

## Item 5 — Disclosures PDF (`zverejnovanie.html` → `apps/web/src/app/[lang]/zverejnovanie/page.tsx`)

| Status | Notes |
|---|---|
| ✓ + **Fixed admin** | Web UI: `d.pdfUrl` renders a `<Download>` button with `download` attribute; falls back to "—" when absent. Strapi mapper already extracts `pdf.data.url` via `populate=*`. **Gap found:** the admin CMS editor's `disclosures` schema had no PDF field. **Fixed:** added `{ k: 'pdfUrl', t: 'text', label: { sk: 'URL súboru PDF', en: 'PDF file URL' } }` to `admin-schemas.ts` → editors can now paste the Strapi media URL for each disclosure. |

---

## Item 6 — Clinic Status Badges (`ambulancie.html` → `apps/web/src/app/[lang]/ambulancie/page.tsx`)

| Status | Notes |
|---|---|
| **Fixed** | `statusBadge` map had `new → badge-blue`. Prototype `site.js` (`statusBadge` function, line 120) maps `new → badge-terra`. Fixed to `badge-terra`. All 4 status values now render correctly: `open=badge-green`, `new=badge-terra`, `alert=badge-amber`, `closed=badge-gray`. Legend above the list uses the same map — also fixed. |

---

## Item 7 — Booking Rule Callouts (`ambulancie.html` → `apps/web/src/app/[lang]/ambulancie/page.tsx`)

| Sub-item | Status | Notes |
|---|---|---|
| Callout conditional | **Fixed** | Was always rendered (even when `bookingRule` is empty). Now wrapped in `{localizeField(clinic.bookingRule, locale) && (...)}` — matches prototype `${c.bookingRule ? ...}` guard |
| Callout styling | **Fixed** | Added `border: 1px solid var(--blue-100)` and `<Info>` icon (16 px, `var(--blue-600)`) matching prototype `.rule-note` style |
| Disabled booking button | ✓ Confirmed | `bookable=false` → disabled `<button>` with `aria-disabled="true"` and "Online objednávanie nedostupné" text |

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/app/[lang]/ambulancie/page.tsx` | Fix `new` status badge; fix booking rule callout (conditional + icon + border) |
| `apps/web/src/app/[lang]/page.tsx` | Accepting-physicians cards: add bio, wrap in `<Link>` |
| `apps/web/src/app/[lang]/oddelenia/[slug]/page.tsx` | Add `detail-grid` / `detail-sidebar` CSS classes |
| `apps/web/src/app/[lang]/lekari/page.tsx` | Add language chip filter |
| `apps/web/src/app/[lang]/aktuality/page.tsx` | Mount `<NewsHashHighlight>` |
| `apps/web/src/components/NewsHashHighlight.tsx` | New client component for hash-based outline |
| `apps/web/src/components/admin/admin-schemas.ts` | Add `pdfUrl` field to disclosures schema |
| `packages/ui/src/globals.css` | Add `.detail-grid` / `.detail-sidebar` 940 px breakpoint rules |

---

## Done-When Criteria

- [x] All 7 items confirmed working or fixed
- [x] No regression on existing page structure (only additive/corrective changes)
- [x] Brief findings report committed to `docs/S5_VERIFICATION_REPORT.md`
