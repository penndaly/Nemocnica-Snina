# Audit notes

Running log of findings that need to survive past the sprint that found them —
things a future change is likely to break without realizing it.

## Hero copy contrast depends on the 62% width cap (Sprint UI-1, 2026-09-10)

`packages/ui/src/globals.css`'s `.has-hero-media` rule:

```css
@media (min-width: 781px) {
  .has-hero-media > .container > *:not(.hero-grid):not(.stepper) {
    max-width: min(64ch, 62%);
  }
}
```

This cap is **load-bearing for contrast, not a cosmetic width choice**. The
hero scrim (`.hero-scrim`) is a left-to-right gradient —
`rgba(16,44,76,.93)` at the left edge fading to `rgba(16,44,76,.22)` at the
right. White hero text (`h1`, `.lede`, etc.) only clears WCAG AA's 4.5:1
against the **dark** (left) half of that gradient. Past roughly the 62% mark
the scrim is too transparent and white-on-photo contrast can drop below
4.5:1, depending on the underlying image.

**Correction (2026-09-10, later same day):** this rule originally started at
`min-width: 1101px` — ported verbatim, but from a *different* source rule
than the one below it, without checking that the two lined up. The scrim
only runs left-to-right above `max-width: 780px`; below that it switches to
a vertical gradient with no transparent side. That left 781–1100px with the
horizontal (fades-to-transparent) gradient active but **no copy-width cap**
— measured at 1.45:1, well under the 4.5:1 floor, and exactly the failure
mode this note warned about. Caught because a peer session doing the
equivalent fix in the prototype's own spec noticed the same gap encoded
there and traced it back here. **The two breakpoints (this one and the
`max-width: 780px` gradient-direction switch two rules below) must always
move together** — this is now true (`781px` / `780px`), but it's exactly
the kind of pairing that's easy to silently re-break by editing one rule
without the other.

**Anyone changing the hero layout must re-run a contrast probe** (hero `h1`,
`.lede`, `.breadcrumb`, `.chip` text, and on `/objednanie` every stepper
label) at 781px+ before shipping, specifically if:
- the scrim gradient direction, stops, or opacity change;
- a new full-width hero variant is added (the current exemption list is only
  `.hero-grid` — home's two-column layout, which is itself narrower than the
  viewport by design — and `.stepper`, the booking wizard's step indicator);
- hero copy is allowed to grow past `min(64ch, 62%)` for any route.

**Update (Sprint UI-1a, 2026-09-10, same day):** this is now machine-verified
— not through the project's full a11y suite (still blocked on Postgres, see
below), but through a dedicated, real contrast computation:
`apps/web/e2e/hero-contrast.spec.ts` composites the actual `.hero-scrim`
gradient (its real stops/alphas) over a worst-case near-white ground, at
every element's measured worst-case (rightmost) position, and computes the
true WCAG contrast ratio — the same method used to find the 1.45:1 failure
above, not just a check that a CSS rule is "active." Verified two ways:
1. Ran against the *current* (fixed) CSS at 320/390/780/781/800/900/1024/
   1100/1101/1280/1440px on both a home-style hero (`h1`/`.lede`/`.chip`)
   and an inner-route hero (`h1`/`.breadcrumb`/`.breadcrumb a`) — 23/23 pass.
2. Proved the test is meaningful, not just green by construction: reverted
   the cap to the buggy `min-width: 1101px`, reran — 5 of those same tests
   failed, all and only in the 781–1100px band, with ratios as low as
   1.65:1. Restored the fix, reran — 23/23 again.

**A second, real bug found by this process** (not present in the original
finding): `.has-hero-media .breadcrumb`'s non-link text was `#a8bdd4`,
which measured as low as **3.05:1** against the composited scrim in the
781–1024px range — failing independently of the cap-position bug above (the
`h1` at the same breakpoints already passed; this was a color problem, not
a position problem). Fixed by matching it to `.lede`'s `#dbe6f2`, which
clears 4.5:1 with margin across the same range (the link color,
`.breadcrumb a`'s `#d6e2f0`, was already fine — it sits further left,
closer to the scrim's opaque side).

**Browser quirk worth knowing about:** SPRINT_UI_1A_CONTRAST_GRID.md named
"assert the computed `max-width` of hero copy is not `none` at 900px" as
the single regression check that would have caught the original bug. That
literal assertion doesn't work — Chromium's `getComputedStyle` reports
`maxWidth: "none"` for this element even when `max-width: min(64ch, 62%)`
is demonstrably the active constraint (confirmed: rendered width jumps from
732px to 255px at exactly the 780→781px boundary, which only an active
width constraint — not content-driven wrapping — would produce). The
committed test asserts on rendered width relative to the container instead,
which reliably catches the same regression without depending on this
serialization quirk.

Still not machine-verified end-to-end: the project's full axe/Playwright
a11y suite (`apps/web/e2e/a11y.spec.ts`) requires a live Postgres instance
(`global-setup.ts` wipes test data via Prisma before every run), which
wasn't available in either sprint's environment. `hero-contrast.spec.ts`
was run directly against a standalone Playwright config that skips that
global setup (it needs no database — pure DOM measurement + composited-color
math) to get the 23/23 result above; it hasn't been proven to run cleanly
through the project's actual `pnpm test:e2e` entry point, which does invoke
the DB-dependent setup regardless of which spec file is selected. Whoever
has a working Postgres instance next should run:

```
pnpm --filter @ns/web test:e2e -- hero-contrast.spec.ts a11y.spec.ts
```

and specifically check the "renders at 130% text scale without horizontal
scroll" and the per-route axe-violation tests (axe's own `color-contrast`
rule is disabled in that suite — checked separately, per the file's own
comment — `hero-contrast.spec.ts` is that separate check for the hero).

---

## ROUTE-1 — `pre-pacientov` and `o-nemocnici` have no route in `apps/web`

Filed 2026-09-10 (Sprint UI-1a companion finding, not fixed in that sprint).

Both pages have full, corrected content in `design_handoff_nemocnica_snina/`
and on the live site, but no corresponding route exists in `apps/web`. Their
nav leaves were dropped during Sprint UI-1 (`SiteHeader`'s grouped nav) to
avoid shipping links to 404s — the right call at the time, but it converted
a missing-route defect into an invisible one: nothing in the running site
now signals that these pages are missing. Both are high-traffic pages on
the live site (confirmed during the earlier live-site content-migration
audit — `content/live-site-migration`, unmerged).

Needs its own sprint, not a quick add: route + page composition from the
handoff HTML, i18n keys (sk/en at minimum, ideally all 6 locales per this
project's established pattern), a hero slot (`patients-hero`, `about-hero`
— both already have placeholder art per `packages/ui/src/placeholder-art.ts`),
and the nav leaves restored to the `visit` and `hospital` groups in
`SiteHeader.tsx`. Scope (which of these, and how many other pages have the
same gap) is being audited separately before this is sized — see whichever
follow-up covers "ROUTE-1 scoping."

Resolved 2026-09-10/12 for two of the (eventually four) missing pages —
`edukacia` and `kariera` shipped in Sprint ROUTE-1a. `pre-pacientov`
(ROUTE-1b) and `o-nemocnici` (ROUTE-1c) remain open.

---

## UI-2 — pre-existing 320px horizontal-scroll overflow (tracked, not fixed)

Filed 2026-09-12, found while re-running Sprint ROUTE-1a's Task 3 no-scroll
check. `documentElement.scrollWidth > innerWidth` at a 320px viewport on
every route checked, **including routes that predate this sprint** — `/`,
`/oddelenia` — not just the two new ROUTE-1a routes (`/edukacia`, `/kariera`).
Confirmed via a standalone Playwright script (not committed) driving the dev
server at the full `320,375,390,414,480,560,620,768,860,941,1024,1100,1280,1440`
ladder from `SPRINT_UI_1A_CONTRAST_GRID.md`'s Task 2 Done-when: every width
≥375px passes; only 320px fails, uniformly across old and new routes.

This is a real defect (WCAG 2.1 AA 1.4.10 Reflow applies at 320px CSS width),
but it's cross-route and pre-existing, not something ROUTE-1a introduced —
patching it inside a route sprint would be scope creep and likely paper over
the actual cause rather than fix it. Needs its own sprint (**UI-2**): find
which shared component(s) force the overflow (likely candidates: `.container`
padding/min-width, a fixed-width card or grid track, or the nav bar itself —
not yet root-caused) and fix once, site-wide, rather than per-route.

**Do not fix ad hoc inside a future route sprint.** If a new route sprint's
no-scroll check also fails only at 320px and passes ≥375px, that's this same
tracked defect, not a new one — note it and move on; if it fails at 375px+
too, that's a new, route-specific bug and should be fixed in that sprint.

---

## ROUTE-1a — axe not run (staging-QA gap, not a false pass)

Sprint ROUTE-1a (`edukacia`, `kariera`, 2026-09-10/12) verified both routes
render correctly (list, filter, sk/en detail pages, relation lookups, and
the no-horizontal-scroll ladder above ≥375px) against the local dev server,
but **axe was not run** — no browser-based accessibility test harness is
available in this execution environment (same limitation recorded above for
Sprint UI-1a). This is not a claimed pass; it's an explicit gap.

Tracked as **STG-2**: run the full `a11y.spec.ts` sweep (which already has
`/sk/edukacia`, `/sk/edukacia/priprava`, `/sk/kariera`, `/sk/kariera/j1`
added to `KEY_ROUTES`) against a real staging deploy before these routes are
considered accessibility-verified, not just render-verified.
