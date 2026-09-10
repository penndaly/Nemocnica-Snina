# Narrow-viewport grid audit — component-keyed fix list

**Scope:** every grid / fixed-min-width / nowrap rule in the handoff prototype,
checked against 320px (the narrowest target) and the intermediate steps.
**Purpose:** turn the remaining horizontal-scroll work into a mechanical pass.
Component names match the prototype; the `apps/web` equivalents carry the same
class names through the UI-1 port.
**Authored:** 2026-09-10 · companion to `SPRINT_UI_HERO_NAV_ART.md`

Global ladder already in `styles.css` (correct, leave alone):
`.grid-3/.grid-4` → 2 cols at ≤940 → 1 col at ≤620; `.grid-2` → 1 col at ≤620;
`.footer-grid` → 2 at ≤940 → 1 at ≤620.

---

## P1 — breaks at 320px, fix these

### 1. `.stat-strip` — `index.html`
`repeat(4,1fr)` → `repeat(2,1fr)` at ≤860, and stops there. At 320px each tile is
~130px wide with 22px padding, leaving ~86px for a 2.1rem Newsreader figure plus a
two-word label. The label wraps to three lines and `24/7` collides with its icon.
```css
@media (max-width:480px){ .stat-strip{ grid-template-columns:1fr; } }
```

### 2. `.wr-avail-grid` — `styles.css` (wearables / portal)
Base is `repeat(auto-fill, minmax(185px,1fr))`, which is self-correcting — but the
`@media (max-width:480px)` rule **overrides it with `1fr 1fr`**, forcing ~110px tracks
below the 185px content floor. The slot content overflows its own track. This is the
one case where the responsive rule is the bug, not the base rule.
```css
@media (max-width:480px){ .wr-avail-grid{ grid-template-columns:1fr; } }
```
(or simply delete the override and let `auto-fill` do it)

### 3. `.search-box` min-width — `lekari.html` (260px), `zverejnovanie.html` (240px)
Sits in a `flex-wrap` toolbar. At 320px the container is 272px, so a 260px minimum
consumes the entire row and the sibling filter chips are pushed to a line they can't
share. `lekari` is the worse of the two.
```css
.search-box{ min-width:200px; }   /* both files */
```

---

## P2 — tight but not broken; fix in the same pass

### 4. `.date-grid` — `objednanie.html`
`repeat(4,1fr)` → `repeat(3,1fr)` at ≤560. At 320px that is ~86px cells holding a
1.7rem serif day number plus a month abbreviation. It fits, barely, with no room for
a longer Slovak month string.
```css
@media (max-width:380px){ .date-grid{ grid-template-columns:repeat(2,1fr); } }
```

### 5. `.nav-panel` — `styles.css`
`min-width:310px` is safe today only because the panel is `display:none` below 1100px.
It is a latent overflow the moment anyone exposes the panel on tablet.
```css
.nav-panel{ min-width:min(310px, calc(100vw - 32px)); }
```

### 6. `.brand-text span` — `styles.css`
The uppercase brand subtitle is `white-space:nowrap`; with the 44px brand mark and the
menu button it is the tightest element in the 320px header. Either allow it to wrap or
hide it below 380px.

---

## Dead code to delete during the port

`.media-hero-band`, `.media-hero-band .media-frame` and the
`@media (max-width:860px)` aspect-ratio override in `styles.css`. `mountHero()` no
longer emits that element — heroes are now `.hero-media` + `.hero-scrim` inside
`.page-hero`. Carrying these into `apps/web` ports rules nothing renders.

---

## Verified safe — do not spend time here

| Component | Why it's fine |
|---|---|
| `.contact-grid`, `.detail-grid`, `.news-aps`, `.hero-grid` | all `1.x fr / .9fr`, all collapse to `1fr` at ≤940 |
| `.clinic-card` | collapses at ≤780 |
| `.feature-list` (oddelenie) | `1fr 1fr` → `1fr` at ≤940 |
| `.bil` (admin) | `1fr 1fr` → `1fr` at ≤860 |
| `.wr-devices-grid` | `repeat(3,1fr)` → `1fr` at ≤780 |
| `.media-gallery`, `.slot-grid` | `auto-fit`/`auto-fill` with a minmax floor under 272px — self-correcting |
| `.table-wrap` (pre-pacientov price list, zverejnovanie register) | `overflow-x:auto` on the wrapper; the table scrolls, the page does not. The `white-space:nowrap` cells inside are intentional and safe because of it |
| `.stepper`, `.toolbar`, `.cta-band`, `.utility-bar .util-left`, `.hero-trust` | all `flex-wrap:wrap` |
| `.success-card` (560px), `.admin-login .login-card` (420px) | `max-width`, not `width` |

---

## Done when
`documentElement.scrollWidth <= innerWidth` on every public route at
320 / 375 / 390 / 414 / 480 / 560 / 620 / 768 / 860 / 941 / 1024 / 1100 / 1280 / 1440px,
and no element's rendered content exceeds its grid track at 320px.

One PR, mechanical — nine declarations plus one deletion. Nothing here is a layout
redesign; if a fix needs a judgment call, it belongs in a different sprint.
