# SPRINT UI-1a — Hero contrast gap + remaining grid fixes

**Status:** ready to run · **Owner:** Claude Code
**Base:** `feat/ui-hero-nav-art` (0f725f7) if unmerged, else `main`
**Branch:** `fix/ui-hero-contrast-gap` · **Authored:** 2026-09-10
**Source of truth:** `design_handoff_nemocnica_snina/assets/styles.css`,
`SPRINT_UI_HERO_NAV_ART.md` (Task 2, corrected), `GRID_AUDIT_NARROW_VIEWPORT.md`

Small, mechanical follow-up to UI-1. One defect and three deferred grid items.

---

## Task 1 — Close the hero contrast gap (defect, P1)

**The bug.** The hero scrim/contrast system has three parts that stopped lining up:

| Part | Breakpoint |
|---|---|
| horizontal scrim gradient (.93 → .22) | default, i.e. ≥781px |
| vertical uniform scrim (.90/.86) | `@media (max-width:780px)` |
| copy cap `max-width:min(64ch,62%)` | `@media (min-width:1101px)` ← **wrong** |

Between **781px and 1100px** the gradient is horizontal but the cap does not apply, so
hero copy runs the full container width into the transparent end of the gradient.

Measured on the home hero at `innerWidth: 924`:
- `.lede` box spans x=24→900, `maxWidth: "none"` (cap not applied)
- text right edge at 97.4% of viewport → scrim alpha ≈ 0.255
- over the pale placeholder art (~`#eef4fa`) the composite ground is ≈`rgb(163,177,191)`;
  lede ink `#dbe6f2` gives **≈1.45:1** against a 4.5:1 requirement
- `matchMedia('(min-width:1101px)').matches === false` **and**
  `matchMedia('(max-width:780px)').matches === false` — neither rule active

**The fix** (already landed in the prototype):
```css
/* Cap starts exactly where the horizontal scrim starts. */
@media (min-width:781px){
  .has-hero-media > .container > *:not(.hero-grid):not(.stepper){
    max-width:min(64ch, 62%);
  }
}
```
Change `1101px` → `781px`. Do **not** instead raise the vertical-scrim breakpoint to
1100px — that would flatten the gradient on tablet and lose the artwork on the right,
which is the point of the design.

**Invariant to record in code comments and in `docs/03-AUDIT.md`:** the copy-cap
breakpoint and the vertical-scrim breakpoint are complementary. Moving one requires
moving the other. There must be no viewport band with a horizontal gradient and no cap.

**Done when:** `h1`, `.lede`, `.breadcrumb` and `.chip` in the hero measure ≥4.5:1 at
**781, 800, 900, 1024, 1100, 1101, 1280 and 1440px** on every route that has a hero, and
≥4.5:1 at 320/390/780px under the vertical scrim. Add a regression test that asserts the
computed `max-width` of hero copy is not `none` at 900px — that single assertion is what
would have caught this.

---

## Task 2 — Remaining grid audit items

From `GRID_AUDIT_NARROW_VIEWPORT.md`. Items 3, 4 and 5 are already applied in
`apps/web`; these three were deferred as "no ported component yet". Apply each **at the
moment its component is ported**, or now if it exists by the time you read this.

1. **`.stat-strip`** (home at-a-glance) — `repeat(4,1fr)` → `repeat(2,1fr)` @860 → needs
   `1fr` @480. At 320px a 2-col tile is ~130px wide and the 2.1rem Newsreader figure
   collides with its label.
   ```css
   @media (max-width:480px){ .stat-strip{ grid-template-columns:1fr; } }
   ```
2. **`.wr-avail-grid`** (wearables availability) — the base
   `repeat(auto-fill,minmax(185px,1fr))` is correct; the `@media (max-width:480px)`
   override to `1fr 1fr` is the bug, forcing ~110px tracks under a 185px content floor.
   Set it to `1fr` or delete the override entirely.
3. **Brand subtitle** — if `SiteHeader`'s subtitle ever gains `white-space:nowrap`, pair
   it with `@media (max-width:380px){ display:none; }`. Currently not applicable in
   `apps/web` (no nowrap); noted so the pairing travels with the rule.

**Done when:** `documentElement.scrollWidth <= innerWidth` on every public route at
320 / 375 / 390 / 414 / 480 / 560 / 620 / 768 / 860 / 941 / 1024 / 1100 / 1280 / 1440px.

---

## Task 3 — Dead code

Confirm `.media-hero-band`, `.media-hero-band .media-frame` and their
`@media (max-width:860px)` aspect-ratio override never reached `apps/web`. Removed from
the prototype (both `styles.css` and `media.js`) — `mountHero()` emits `.hero-media` +
`.hero-scrim` inside `.page-hero` now, so those selectors match nothing.

---

## Out of scope
Missing `pre-pacientov` / `o-nemocnici` routes (separate finding — see below), the
broader pre-existing overflow (`ambulancie` clinic-card grid et al.), IMG-1, STG-1.

## Non-negotiables
WCAG 2.1 AA, axe zero critical/serious on every route. Fix root causes; do not skip a
test to go green. If a contrast check cannot run in this environment, say so plainly in
`03-AUDIT.md` rather than claiming a check that did not happen.

---

# Companion finding — missing routes (file, do not fix here)

`pre-pacientov` and `o-nemocnici` have full, corrected content in the handoff and on the
live site, but **no route in `apps/web`**. Their nav leaves were dropped during UI-1 to
avoid shipping 404s — correct at the time, but that converted a missing-route defect into
an invisible one. Both are high-traffic pages on the live site.

Log as `ROUTE-1` with today's date. Needs its own sprint: route + page composition from
the handoff HTML, i18n keys, hero slot (`patients-hero`, `about-hero` — both already have
placeholder art), and the nav leaves restored to the `visit` and `hospital` groups.
