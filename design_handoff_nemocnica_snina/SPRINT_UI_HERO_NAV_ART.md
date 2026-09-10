# SPRINT UI-1 — Hero imagery, grouped navigation, placeholder art

**Status:** ready to run · **Owner:** Claude Code · **Base:** `main`
**Branch:** `feat/ui-hero-nav-art` · **Discovered/authored:** 2026-09-10
**Source of truth:** `design_handoff_nemocnica_snina/` at this commit — specifically
`assets/placeholder-art.js`, `assets/media.js`, `assets/site.js`, `assets/styles.css`,
`index.html`, `PLACEHOLDER_ART.md`.

## Why
The site read as text-only and the nine-item flat nav wrapped unevenly. The handoff
prototype now: (a) opens every page with a full-bleed hero image with overlaid copy,
(b) collapses the nav into four grouped items with description panels, and (c) fills
every unphotographed image slot with on-brand illustrated artwork so the site presents
fully dressed before IMG-1 lands. Port all three to `apps/web`.

**One sprint per turn. Commit after each task. Report Done-when before proceeding.**

---

## Task 1 — Placeholder art module

Port `assets/placeholder-art.js` to `packages/ui/src/placeholder-art.ts`.

- Export `sceneFor(id): SceneName`, `sceneDataUri(name): string`, `monogram(initials): string`.
- Scenes are pure functions returning an SVG string on a 1600×900 canvas, drawn **only**
  from `packages/ui` design tokens (medical blue, warm cream/sand, terracotta, green,
  amber). 18 scenes: `campus, aerial, corridor, ward, nurse, consult, team, equipment,
  lab, imaging, pharmacy, waiting, reception, video, archive, education, news, docs,
  admin, booking`. Copy the geometry verbatim from the handoff file — it is tuned for
  the 12/5 and 4/3 crops.
- No faces, no identifiable detail, no institution names. This is a compliance
  constraint, not a style note (see the IMG-0 leak findings: ~40% of licence-clean stock
  candidates contained a real leak).
- Memoise per scene name. Data URI is `encodeURIComponent`'d SVG, not base64.

**React surface:** `<HospitalImage slot="patients-hero" alt={…} />`
- If the CMS media field for `slot` is populated → `next/image` with the real photo.
- Else → the generated SVG as an inline background/`<img>`, plus `data-placeholder-art`
  on the element.
- Heroes: `loading="eager"` + `fetchpriority="high"`; everything else lazy (media conventions).
- `alt` comes from i18n keys in **both** sk and en. Placeholder art is decorative when it
  sits behind hero copy → `alt=""` in that position; the hero's own `<h1>` carries meaning.

**Done when:** every slot id in `assets/media.js` `PLAN` resolves to a scene;
`sceneFor` unit tests cover explicit ids, `dept-<id>`, `dept-<id>-hero`, `doc-<id>`,
and the regex fallbacks; no hardcoded hex outside the token import.

---

## Task 2 — Hero image band on every route

Component `<PageHero>` in `packages/ui`, used by every `/[lang]/…` public route.

Structure (matches `.has-hero-media` in the prototype):

```
<section class="page-hero has-hero-media">
  <div class="hero-media">   ← image or placeholder art, absolute inset 0, object-fit cover
  <div class="hero-scrim">   ← absolute inset 0, z-1
  <div class="container">    ← relative, z-2: breadcrumb, eyebrow, h1, lede, chips, buttons
</section>
```

Exact values, do not re-derive:

- `.has-hero-media` — `position:relative; overflow:hidden; padding:76px 0; min-height:400px;
  display:flex; align-items:center; border-bottom:none`
- `.hero-scrim` — `linear-gradient(90deg, rgba(16,44,76,.93) 0%, rgba(16,44,76,.90) 46%,
  rgba(16,44,76,.60) 72%, rgba(16,44,76,.22) 100%)`
- `@media (min-width:1101px)` — hero copy capped at `min(64ch, 62%)` so text never crosses
  into the light half of the scrim. **This cap is what keeps contrast ≥4.5:1** — do not drop
  it when refactoring. Exempt full-width children (the booking stepper).
- `@media (max-width:780px)` — `min-height:0; padding:44px 0`, scrim switches to vertical
  `linear-gradient(180deg, rgba(16,44,76,.9), rgba(16,44,76,.86))`
- Overlay ink: `h1/h2 #fff`, `lede/p #dbe6f2`, `eyebrow #f0b48a`, breadcrumb `#a8bdd4`
  with links `#d6e2f0`, chips `rgba(255,255,255,.14)` on `rgba(255,255,255,.28)` border.
- **Reset for cards inside a hero** (the home emergency card): `.card p/.small/label →
  ink-2`, `.card h1–h4 → ink`, `.card .muted → ink-3`, `.emergency-card h3 → red`,
  `.card .chip → warm-100`. Without this the card's own copy inherits the light overlay ink.
- Booking stepper on dark ground: `.step-lbl #c3d5e8`, `.step.active .step-lbl #fff`,
  `.step.done .step-lbl #dbe6f2`, `.step-num rgba(255,255,255,.20)/#fff`,
  `.step.active .step-num #fff / blue-900`, `.step.done .step-num green/#fff`,
  `.step-line rgba(255,255,255,.32)`.
- `.btn-ghost` inside a hero: `rgba(255,255,255,.12)` bg, `rgba(255,255,255,.42)` border,
  `#fff` text, hover `.22`. Buttons in heroes are supported and expected.

Per-route hero slots: `home-campus, about-hero, patients-hero, careers-hero,
education-hero, departments-hero, clinics-hero, diagnostics-hero, services-hero,
physicians-hero, news-hero, contact-hero, booking-hero, telehealth-hero,
teleconsult-hero, disclosure-hero`, plus the department detail route which resolves
`dept-<id>-hero` from its route param.

**Done when:** every public route renders a hero with image + scrim + overlaid copy;
axe reports zero critical/serious on every route; a contrast probe of hero `h1`, lede,
breadcrumb, chips and (on `/objednanie`) every stepper label returns ≥4.5:1 at 390px,
768px, 1024px, 1440px.

---

## Task 3 — Grouped primary navigation

Replace the nine flat links with four top-level items. Leaf order and copy are fixed:

| Group | sk / en | Leaves |
|---|---|---|
| `care` | Starostlivosť / Care | departments · clinics · doctors · diagnostics · services |
| `visit` | Pre pacientov / For patients | patients · booking · portal |
| `hospital` | Nemocnica / Hospital | about · news · disclosures |
| `contact` | Kontakt / Contact | *(direct link, no panel)* |

- Each leaf shows `<b>label</b>` + a one-line `<span>` description; the sk/en strings are
  in `assets/site.js` `navGroups` — lift them into the i18n message files verbatim.
- `active` is a **leaf** key; it highlights both the leaf and its group button.
- Panel opens on hover **and** `:focus-within`; must be fully keyboard operable and
  dismissible with Escape. Add `aria-expanded` / `aria-haspopup` and roving focus —
  the prototype's CSS-only version is the visual spec, not the a11y spec.
- Panel: `min-width:310px`, `top:calc(100% + 8px)`, `left:-8px`, surface bg, `--line`
  border, `radius:14px`, `--shadow-lg`, 8px padding.
- **Collapse breakpoint is 1100px, not 940px.** Brand + 4 groups + 2 CTAs do not fit
  below ~1090px; at 940px the bar overflowed and the whole page scrolled sideways.
  `.nav-main` is `flex-wrap:nowrap`.
- Mobile menu groups under uppercase `.mm-head` headings, then the primary Book CTA.

**Done when:** no horizontal page scroll at 320/375/768/941/1024/1100/1280/1440px on every
route (`documentElement.scrollWidth <= innerWidth`); panels operable by keyboard alone;
axe clean; E2E nav test updated for the new structure.

---

## Task 4 — Documentation

- Port `PLACEHOLDER_ART.md` into the repo docs (scene map, palette rule, scrim/contrast
  rule, the "real photo always wins" contract).
- `DATA_MODEL.md`: note that every media field has an art fallback, so an unpopulated
  media field is a *presentation-complete* state, not a broken one.
- `03-AUDIT.md`: record that hero copy contrast depends on the 62% copy cap — a future
  full-width hero layout must re-run the contrast probe.

---

## Out of scope
Real photography (IMG-1), staging deploy (`STG-1`–`STG-3`), the ESLint `**/lib/**`
ignore, and anything on `content/live-site-migration` or `schema/clinic-coming-soon-status`.

## Non-negotiables that apply here
- WCAG 2.1 AA, axe zero critical/serious on every route (Act 351/2022).
- Every image `alt` in both sk and en via i18n keys; decorative → `alt=""`.
- No new colours — tokens only.
- Fix root causes; do not skip a test to go green.
