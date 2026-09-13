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

### Full-ladder result (2026-09-12, close-out of the ROUTE-1 series)

Ran the complete ladder once across every public route after the last of the
four missing routes landed: **21 routes × 14 widths = 294 checks.**

- **320px fails on all 21 routes** (scrollWidth 349–364 vs 320). Uniform
  across routes that predate this work and routes added by ROUTE-1a/1b/1c
  alike — so it is a shared-shell defect (the ~349px floor is the same
  everywhere), not per-page. That ~29–44px is the thing UI-2 needs to find.
- **Every route passes at 375px and above — except `/kontakt`.**

### UI-2a — `/kontakt` overflows up to 480px (worse than the 320px case)

`/sk/kontakt` reports a constant `scrollWidth` of **523px**, failing at 320,
375, 390, 414 **and** 480px — i.e. it does not reflow on any common phone,
where every other route only trips at 320px.

Root cause, located: `apps/web/src/app/[lang]/kontakt/page.tsx:38` sets

```
style={{ display: 'grid', gridTemplateColumns: '1.3fr .85fr', … }}
```

as an **inline** style. Two `fr` tracks each still hold their min-content, so
the body + sticky `<aside>` (the Quick-contact card, overflowing to x=521)
cannot collapse to one column — and because the rule is inline, no media
query can override it.

Fix path already exists and needs no new CSS: `.detail-grid` / `.detail-sidebar`
in `packages/ui/src/globals.css:306-311` do exactly this collapse at 940px and
are already used correctly by `/oddelenia/[slug]`. Swapping kontakt's inline
grid for those classes should resolve it. Left for UI-2 rather than patched
inside a route sprint, per the standing call on this class of defect.

---

## ROUTE-1a — axe not run (staging-QA gap, not a false pass)

> **⚠ This entry is WRONG, not merely superseded (marked 2026-09-12, STG-3).**
> Its premise — "no browser-based accessibility test harness is available in
> this execution environment" — was false when it was written. Chromium and
> `@axe-core/playwright` ran here the whole time; the ROUTE-1a/1b/1c and
> UI-1a claims of "cannot run axe locally" were never checked against the
> installed tooling, and the first local axe run (STG-2, same day) found a
> serious violation on two of the routes this entry deferred. Axe is a
> mandatory local rung for every new route; see the STG-2 close-out below.
> The text is kept unedited as the record of what was claimed.
>
> **A limit of the class-coverage audit, stated for the record:** the
> STG-2 defect (colour-only prose links) was a *site-wide base-style*
> problem — `a { text-decoration: none }` was defined and applied, just
> wrong. `audit:classes` checks that every class *resolves* to a rule and
> `styled.spec.ts` checks that a rule is *applied*; neither can tell a
> correctly-applied wrong style from a right one. Only a rule-based checker
> (axe) or a human sees that class. Do not read a green class-coverage run
> as an accessibility result.

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

**2026-09-12 update:** same gap applies to Sprint ROUTE-1b's
`/sk/pre-pacientov` (added to `KEY_ROUTES` alongside the others) — axe still
not run, for the same environment reason. No-horizontal-scroll re-checked
at 375-1440px for `/sk/pre-pacientov` (the `visit` nav group grew one row);
all pass — same UI-2 320px-only failure as every other route, not a new
regression. ROUTE-1c's `/sk/o-nemocnici` carries the same axe gap.

---

## Unported CSS primitives shipped unstyled markup (ROUTE-1b, fixed in 1c)

Found 2026-09-12 while porting the `/o-nemocnici` history timeline.

`packages/ui/src/globals.css` is the app's only stylesheet, and it had never
received several layout primitives that exist in the prototype's
`assets/styles.css`: `.section`, `.grid`/`.grid-2`/`.grid-3`, `.table-wrap`,
`.wait-row`/`.wr-clinic`, `.quote-card`, and the `.mt-*`/`.mb-*` scale.

Sprint ROUTE-1b's `/pre-pacientov` used all of them, so it shipped with the
waiting-time rows unstyled (no flex row, no separators), the testimonial
cards missing their terracotta rule and serif quote, the price table without
its scroll container, and the card pairs/triples stacked because `.grid-2`
and `.grid-3` were inert. The section bands had no vertical padding.

**Why it survived verification:** the ROUTE-1b check was content-presence
(`curl` + `grep` for expected strings) plus the no-scroll ladder. A missing
class fails neither — `.grid-2` with no rule still renders every child, just
in one column, and stacking *reduces* width so the scroll check is happy.

**The lesson, worth keeping:** for any new markup, assert a computed style,
not just that the text is in the HTML. The check that caught this is a
headless-browser `getComputedStyle` probe on one element per new class
(`grid-template-columns` has 2 tracks, `.wait-row` is `display:flex`,
`.quote-card` has a 4px left border, `.section` has 76px padding). Cheap,
and it is the only thing that distinguishes "rendered" from "styled".

All of the above are now ported verbatim into `globals.css` and verified by
computed style. The full `.mt-*`/`.mb-*` scale was ported rather than only
the steps in use, because a partially-present utility scale fails silently
in exactly this way.

---

## UI-2a — `/kontakt` fixed + class-coverage audit + computed-style ladder (2026-09-12)

Three things in one sprint, because the `/kontakt` overflow and the ROUTE-1b
unstyled markup were the same defect class seen from two sides: markup that
names a style it doesn't get.

### 1. `/kontakt` class swap (the symptom)

`apps/web/src/app/[lang]/kontakt/page.tsx` now puts `.detail-grid` on the
body grid and `.detail-sidebar` on the sticky aside, same as
`/oddelenia/[slug]` and `/lekari/[slug]`. Measured after the change
(headless Chromium, `documentElement.scrollWidth` vs viewport):

| width | before | after | `.detail-grid` tracks | aside |
|---|---|---|---|---|
| 320 | 523 | 349 | 1 | static |
| 375 | 523 | 375 | 1 | static |
| 390 | 523 | 390 | 1 | static |
| 414 | 523 | 414 | 1 | static |
| 480 | 523 | 480 | 1 | static |
| 941 | 941 | 941 | 2 | sticky |
| 1280 | 1280 | 1280 | 2 | sticky |

320px now sits at the same ~349px floor as every other route — i.e. the
route-specific defect is gone and what remains is the shared UI-2 one.

### 2. Class-coverage audit (assume 1b wasn't the only one — it wasn't)

Every class name referenced from a `className=` in `apps/web/src` (static
strings, template literals and ternary branches inside `className={…}`)
cross-checked against `packages/ui/src/globals.css`, the app's only
stylesheet. 108 distinct classes referenced, 119 defined. Unknown:

| class | where | verdict | action |
|---|---|---|---|
| `edu-body` | `edukacia/[slug]` article body | **real gap** — prototype rule never ported; richtext `h4` rhythm and body colour/line-height missing (the page carried a partial inline copy) | ported; inline copy removed |
| `spin` | `admin/gdpr`, `admin/tools`, `admin/translations` (`<Loader2 className="spin">`) | **real gap** — no rule *and* no keyframes anywhere; busy-state icons sat still | `@keyframes spin` + `.spin` added, reduced-motion slowed |
| `h3` | `objednanie/zrusit/[token]` (`<h1 className="h3">`) | **real gap** — no rule in prototype or app; the result-card h1 rendered at full h1 size | `.h3` heading-size utility added (mirrors base `h3`) |
| `flex` `items-center` `justify-center` `gap-3` `py-16` `mb-6` `mt-6` `animate-spin` | `objednanie/zrusit`, `admin/login` | Tailwind utilities — `globals.css` has `@tailwind utilities` and the content glob covers `src/**`; **confirmed emitted** by computed style (`display:flex`, `padding-top:64px`, `gap:12px`, `animation-name:spin`) | allowlisted by name in the audit script (not by pattern — Tailwind is not the app's convention) |
| `site-header` `utility-bar` | `SiteHeader.tsx`, `UtilityBar.tsx` | hook-only — the components carry the prototype's rules inline | allowlisted. **UI-2 lead:** the prototype's `.utility-bar .container` has `flex-wrap: wrap`; the inline port doesn't. Worth checking first when hunting the 320px floor. |

Found on the way, fixed because it was one line: `objednanie/zrusit/[token]`
rendered its own `<main id="main-content">` *inside* `SiteLayout`'s — a
nested main landmark with a duplicate id (axe `landmark-no-duplicate-main`,
`duplicate-id`). Now a `<div>`.

Not found: any class that is *defined* but silently wrong — that's what
layer 2 below is for.

### 3. The durable fix — verification ladder now has two new rungs

Content-presence (`curl` + `grep`) plus the no-scroll ladder can never again
pass an unstyled section on their own, because they are no longer the whole
ladder:

- **Static — `apps/web/scripts/audit-classes.mjs`** (`pnpm --filter=@ns/web
  audit:classes`, wired into the CI lint job). Fails on any class referenced
  by markup and defined nowhere. Negative-tested: an injected `zzz-nope`
  class exits 1. ~50ms. Catches the ROUTE-1b case at commit time.
- **Runtime — `apps/web/e2e/styled.spec.ts`**. One `getComputedStyle`
  assertion per ported layout primitive on a real element on a real route
  (`.detail-grid` track count at 1280 vs 390, `.section` padding, `.grid-2`/
  `.grid-3` collapse, `.wait-row` flex, `.quote-card` border, `.table-wrap`
  overflow, `.hist-timeline`, `.edu-body`, `.h3`, `.spin`, and the Tailwind
  utilities the allowlist depends on). A missing selector fails with
  `NO-ELEMENT` rather than probing nothing. The same file carries the
  **committed** no-horizontal-scroll ladder (13 widths × 19 public routes),
  previously an uncommitted one-off; 320px is asserted as `test.fail` so it
  flips loudly when UI-2 lands. Run: 44/44 green, 2026-09-12, Chromium
  desktop, against the local dev server (API down — the spec waits for
  `load` + `main`, not `networkidle`, for exactly that reason).

**Standing rule (also in `CLAUDE.md`):** a verification claim names the
method, not the outcome. "content present + scroll ladder" is a true
statement about ROUTE-1b that would have shown the gap at the time;
"renders correctly" hid it. Add a `styled.spec.ts` row for every class you
port; the audit script will tell you when you forgot.

---

## CMS-1 — Strapi i18n is not enabled on any collection (`pluginsOptions` typo)

Found 2026-09-12 while scoping the Rusyn locale. All 20
`apps/cms/src/api/*/content-types/*/schema.json` files spell the i18n option
`"pluginsOptions"` (0 files use `pluginOptions`). Strapi 4 reads
`pluginOptions`, so `"i18n": { "localized": true }` is ignored everywhere and
every collection is single-locale. The bootstrap creates the six locale rows
and registers the review gate, but there has never been localized content
for either to act on. Fix = rename the key in 20 files, boot Strapi against
Postgres and confirm the `locale`/`localizations` columns appear; existing
rows become `sk`. Needs Docker; not fixable in the scoping environment.
Separately: Strapi 4.25.0's bundled ISO list has no `rue` (Rusyn) entry, so
the Rusyn locale cannot be added from the admin UI; the bootstrap service
path is the probable route and is unverified. See
`design_handoff_nemocnica_snina/SPRINT_I18N_RUSYN.md`.

## FONT-1 — `Newsreader` has no Cyrillic; `uk` headings already fall back to Georgia

Found 2026-09-12. Google Fonts serves Newsreader with `latin`, `latin-ext`,
`vietnamese` only (Mulish does ship `cyrillic`). Method: width comparison in
Chromium — "Відділення лікарні" at 40px/600 measures 406.6px in the
`Newsreader, Georgia, serif` stack vs 408.2px in plain Georgia, while Latin
text measures 383px vs 445px. `document.fonts.check` is *not* a valid test
here: it returns true when no declared face covers the text. Every heading on
`/uk` renders in Georgia today, silently. Fix path and font choice are a call
in `SPRINT_I18N_RUSYN.md` (C3).

## UI-3 — grouped header nav collides with the CTA buttons (pre-existing; `uk` at every desktop width, `sk` at the 1101px boundary)

Found 2026-09-12, screenshots taken. `.nav-links` has `flex:1; min-width:0`
and its content overflows its box into the CTAs; the last group label
("Контакти" / "Kontakt") overlaps "Портал пацієнта" / "Pacientsky portál".

| locale | width | last `.nav-top` right | first CTA left | overlap |
|---|---|---|---|---|
| uk | 1101 | 900 | 729 | 171px |
| uk | 1280 | 950 | 858 | 92px |
| uk | 1440 | 1030 | 938 | 92px |
| sk | 1101 | 819 | 781 | 38px |

Not caught by the no-scroll ladder because the overflow is inside the
header (`documentElement.scrollWidth` stays equal to the viewport) — the
ROUTE-1b blind spot again. The durable check is a per-locale "last group
right edge < first CTA left edge" assertion in `styled.spec.ts` at
1101/1280/1440, which the Rusyn sprint adds (C4). Any seventh locale makes
this worse; fix it first.

### UI-2b close-out (2026-09-12) — content-aware collapse; UI-3 fixed

Rusyn call C4(a), pulled ahead of the Rusyn build as its own sprint. The
1100px CSS breakpoint stays as the floor. Above it `SiteHeader.tsx` now
measures, in a `useLayoutEffect` with a `ResizeObserver` on the container
and a re-run on `document.fonts.ready`: brand + Σ`.nav-links` children +
CTAs + the two container gaps, against the container's content box. If
that sum exceeds it, the header gets `.nav-collapsed` / `data-nav=
"collapsed"`: the nav and the CTA block are parked off-flow
(`position:absolute; visibility:hidden` — *not* `display:none`, so their
intrinsic widths stay measurable and the header can expand again) and are
`inert` + `aria-hidden`; the hamburger shows. The sum is built from the
children's intrinsic widths (`.nav-top` is `nowrap`, flex items don't
shrink below content), so it is identical in both states — no hysteresis.
New classes `nav-collapsed`, `header-ctas` have rules in `globals.css`;
`audit:classes` 0 unknown.

Method: `styled.spec.ts` §3 — for 6 locales × 1101/1280/1440, either
`data-nav=expanded` and last `.nav-top` right edge < first `.header-ctas
.btn` left edge, or `collapsed` with the nav `visibility:hidden` + `inert`
and the hamburger displayed; page `scrollWidth` ≤ viewport throughout. Plus
an over-trigger guard (sk/en must stay expanded at 1280/1440) and a
same-page resize test (sk 1101 → 1280 → 1101 flips collapsed → expanded →
collapsed with no navigation). Measured edges (Chromium, fonts loaded):

| locale | 1101 | 1280 | 1440 |
|---|---|---|---|
| sk | **collapsed** | expanded 869 < 910 | expanded 949 < 990 |
| en | expanded 728 < 791 | expanded 778 < 920 | expanded 858 < 1000 |
| cs | expanded 752 < 781 | expanded 802 < 910 | expanded 882 < 990 |
| pl | expanded 767 < 812 | expanded 817 < 941 | expanded 897 < 1021 |
| hu | **collapsed** | expanded 853 < 950 | expanded 933 < 1030 |
| uk | **collapsed** | **collapsed** | **collapsed** |

The UI-3 table's four overlaps are all gone (sk@1101 and uk everywhere
now collapse instead of overlapping). Axe (wcag2a/2aa/21aa, contrast rule
excluded as in `a11y.spec.ts`) on `/uk`@1280 and `/sk`@1101 (collapsed)
and `/sk`@1280 (expanded): 0 critical/serious. Full `styled.spec.ts` +
`a11y.spec.ts` against the dev server with the DB-free temp config: 73
passed, the 19 `320px reflow` rows still the tracked UI-2 expected
failures. Screenshots taken for sk/en/uk at all three widths (not
committed). `pnpm --filter=@ns/web typecheck` and `lint` clean for the
changed files.

**Consequence to know:** `.container` is capped at `--maxw: 1180px`, so
`uk` (needs ≈1290px of content box) is collapsed at *every* desktop
width — the hamburger is its desktop navigation. That is what C4(a) buys:
correct for whatever a translator returns, at the price of a shorter nav
for long-label locales. Shortening `uk`'s group labels (or C4(b)) would
restore the desktop nav there. **Call made 2026-09-13 (user): leave it.
This is expected behaviour, not a defect — do not shorten the Ukrainian
group labels to fit a container; a hamburger at desktop is a mild
degradation, an overlapping nav is a broken one.** Revisit only if `rue`'s
endonyms land longer still, and then as a container-width question
(`--maxw`), not a translation one. Rusyn's labels are measured by the same
assertion the day they land (the `rue` row is in `styled.spec.ts` §3).

**Limitation:** the server renders `expanded`; the measurement runs in a
layout effect after hydration, so on a long-label locale there is a
pre-hydration frame or two with the overlapping nav. Not observable in the
Playwright run (fonts + hydration settle before the probe) and not
addressed here.

### CMS-1 close-out (2026-09-12) — this is a behaviour change, not a typo fix

Renaming `pluginsOptions` → `pluginOptions` in 20 schemas turns localization
**on for every collection at once**. Before: 0 of 20 content types localized
(every flag ignored; one row per entry, no `locale` column). After, verified
by booting Strapi 4.25 against a scratch SQLite DB (`apps/cms/scripts/
verify-i18n-gate.js`, `pnpm --filter nemocnica-snina-cms verify:i18n`):

| content type | kind | localized fields after | review-gated |
|---|---|---|---|
| department | collection | name, short, leadRole, deputyRole, summary, desc, facilities, visiting + 4 review fields (12) | yes |
| clinic | collection | name, specialty, location, schedule, bookingRule, fee, telehealthRule + 4 review (11) | yes |
| physician | collection | role, bio + 4 review (6) | yes |
| service | collection | name, desc + 4 review (6) | yes |
| facility | collection | name, kind, desc, features + 4 review (8) | yes |
| news-item | collection | tag, title, body + 4 review (7) | yes |
| education-article | collection | title, excerpt, body + 4 review (7) | yes |
| pages-content | single | 12 hero/about/gdpr/a11y/telehealth strings | no |
| about-info | single | owner, leadership, ethics, adverseEvents, antiCorruption, transfusionCommittee, rankings (7) | no |
| careers-info | single | contact, benefits (2) | no |
| hospital | single | tagline, region (2) | no |
| certification, clinic-waiting-time, disclosure, history-milestone, investment, job-posting, leadership-member, patient-testimonial, price-list-item | collection | 1–2 each | no |

Three single types (about-info, careers-info, hospital) had field-level
flags but no content-type-level flag; Strapi needs both, so the type-level
flag was added — otherwise those fields would have stayed single-locale
after the rename. Existing rows (there are none in a tracked DB; dev is
SQLite) become the default locale.

**What the boot also uncovered — two more things that had never run:**

- **Default locale was `en`, not `sk`.** The plugin seeds `en` on first boot
  and ignores `defaultLocale`/`locales` in `config/plugins.js` (those keys do
  not exist in @strapi/plugin-i18n 4.25; removed with a note). The bootstrap
  loop in `src/index.js` created `cs/pl/hu/uk/en` and **skipped `sk`**, so a
  `locale: 'sk'` write would have failed and any entry created without a
  locale would have landed in `en`. Bootstrap now creates all six with native
  names and sets `sk` as default.
- **The dev SQLite dialect name was wrong** (`better-sqlite3` → "Unknown
  dialect"; Strapi's name is `sqlite`). Separate commit.

**Publish gate exercised for the first time** (all 12 assertions pass):
`sk` publishes without review; a `cs` department is forced to draft with
`review_status=needs_review` on create; publishing it throws
`Cannot publish cs content without review_status='approved'` and leaves it
a draft; after approval it publishes; a non-clinical `cs` entry
(history-milestone) passes through; and a **`rue` locale registers through
the locales service** (the path the bootstrap uses — the admin UI's yup
schema would reject it as not in the ISO list), with content creatable in
it. That last assertion is what the Rusyn sprint's CMS half will rely on.

Not covered: the Strapi admin UI itself was not opened (no `strapi build`
here); CI does not run the CMS. `verify:i18n` is the standing check.

### CMS-1 follow-ups (2026-09-12, same day, at the user's direction)

**No backfill audit is owed — stated explicitly for the record.** Because
0 of 20 content types were localized before this fix, no entry in any
Strapi database built from this repo could ever have carried a locale other
than the default. The review gate keys on `data.locale`, which never existed
on any row, and the seed importer writes Slovak only. Therefore no `cs`,
`pl`, `hu` or `uk` clinical entry has ever existed, published or draft, and
nothing published unreviewed. On first boot after the fix Strapi assigns
the default locale (`sk`) to every pre-existing row. Verification for any
environment that carried content before the fix: `SELECT DISTINCT locale
FROM departments` (and the other six clinical tables) must return only `sk`.

**CI-1 — CI never ran the CMS.** The actual finding under CMS-1: no job in
`ci.yml` installed, booted or tested `apps/cms`, so the lifecycle hook that
enforces "review-gated clinical content never auto-publishes" (a legal
requirement) had zero execution history. Fixed: `cms-verify` job runs
`pnpm verify:i18n` (12 assertions against a scratch SQLite DB) on every
push/PR, and the staging smoke gate now depends on it.

**CI-1 install method (pinned 2026-09-12, at the user's direction):**
`apps/cms` is deliberately **npm-managed** and is the one exemption from
the "always pnpm" convention in `CLAUDE.md` (now recorded there too). The
job runs `npm ci --workspaces=false` from `apps/cms/package-lock.json`
because Strapi 4's packages depend on undeclared internal deps that pnpm's
strict layout can't resolve — the first `cms-verify` boot under pnpm failed
exactly there (`4111a9f`). Anyone who "fixes" the job back to pnpm silently
stops the publish-gate verification from booting. **Open inconsistency:**
`infra/docker/Dockerfile.cms` still installs with pnpm; its boot was
verified on 2026-08-24 against an earlier lockfile and has not been rebuilt
since the npm switch. Until it is rebuilt with `npm ci` (or re-verified as
is), the staging Strapi image is not known to boot. **Resolved 2026-09-13
(folded into I18N-RUE T1 at the user's direction):** `Dockerfile.cms` now
copies only `apps/cms` and runs `npm ci --workspaces=false` from its
package-lock, identical to the CI job; `docker-compose.production.yml`'s
Strapi service points at `/app` + `npm start` accordingly. Not built here
(Docker down) — the install path is the one CI proves on every push; the
image build itself is verified the first time the deploy workflow runs.

**MT-1 — the DeepL note is now a guard.** `TranslationProviderService`
carries the provider's supported-target set (DeepL's list; the mock uses
the same one so dev is never more permissive than prod), refuses to
construct if `MT_TARGET_LOCALES` names an unsupported locale, and
`translate()` throws `UnsupportedTranslationLocaleError` for one. Tests
assert `rue` throws under both providers and at construction. Nothing calls
`translate()` yet; when the MT loop lands it inherits the guard.

## API-1 — API could not boot on main from the content merge (ROUTE-1b DI gap)

Found 2026-09-12 from the CI E2E job on `a1a4f57`: `node dist/main` exited
with *Nest can't resolve dependencies of the StaffJwtGuard (…JwtService…)*.
`ComplaintsModule` (ROUTE-1b) guards its admin controller with
`StaffJwtGuard` but never imported `AuthModule`, which provides
`JwtService`. Typecheck, lint, build and every unit test passed; only a
real boot fails. **The staging deploy on the same commit reported success**
because it polls only the web route (`/sk`), not `/api/health` — so staging
ran with a dead API and nobody was told. Two more main pushes (`e04b609`,
`7f05626`) carried the same defect; E2E was red on all of them.

> **Correction (STG-3, 2026-09-12): the sentence above about why the deploy
> reported success is wrong.** The deploy workflow did not poll anything on
> those commits. `STAGING_HOST` has never been configured, so the workflow's
> "success" was its no-op guard job alone — `Build & push images` and
> `Roll staging host` were both *skipped* on every run since the workflow
> landed (2026-08-24). No host ever ran a dead API, because no host has
> ever been rolled. The `/sk`-only poll was a real gap and is fixed by STG-3,
> but it is not what produced the green tick. See STG-3 below for the run-
> by-run backfill.

Fixed: `AuthModule` imported. Regression: `src/__tests__/app-module-di.test.ts`
compiles each new feature module with the same globals AppModule supplies
(ConfigModule, @Global PrismaModule) and nothing else, so a missing import
fails in ~30ms with no infra. Proven both ways (fails on the bug, passes on
the fix). Compiling `AppModule` whole hangs in Jest (an async provider
factory waits on a connection), so the whole-graph boot check remains the
E2E job's real `node dist/main`.

**Open follow-up (STG-3):** the staging deploy's readiness poll must include
`${STAGING_API_URL}/health`; a green deploy with a dead API is the worst
possible signal.

## STG-2 close-out — axe ran; ROUTE-1 pages had one serious violation each (fixed)

2026-09-12. Once API-1 was fixed the CI E2E job got past API start and
ran `a11y.spec.ts` on the ROUTE-1 routes for the first time. Result: 513
passed, 6 failed — all six the same rule, `link-in-text-block` (serious),
on `/sk/kariera` and `/sk/pre-pacientov` in every project. Inline links in
running text (the HR mailto, the diagnostics link, the complaint-form
mailto) were distinguishable from surrounding text by colour only
(WCAG 1.4.1). The base `a { text-decoration: none }` made this true of
every prose link on the site, so the fix is one global rule: links inside
`p`/`li`/`td`/`dd`/`.lede` are underlined; `.btn`/`.chip` keep their own
affordance. Method: `styled.spec.ts` asserts `text-decoration-line:
underline` on the exact flagged element and `none` on a button; axe
re-run locally on both routes and then on all 20 `KEY_ROUTES`: 20/20 pass.

**Correction to the standing note that "no browser-based a11y harness is
available in this environment":** it is. `@axe-core/playwright` + the
installed Chromium run fine with the DB-free temp config used for
`styled.spec.ts`. That note dates from before Playwright was proven here;
from now on axe is part of the local ladder for any new route, not a
staging-only gap.

Two other E2E failures on the same run (`TH-6.2` admin telehealth config,
`A4` admin sidebar) were reported flaky by Playwright's retry and passed on
retry; not related, not investigated here.

---

## STG-3 — deploy gate never checked the API; and the "green" staging deploys were skips

2026-09-12, taken before UI-2b at the user's direction: a visual fix confirmed
on staging is worth nothing if the staging signal is unverified.

### What was wrong

1. **The readiness poll covered only the web route.** `deploy-staging.yml`
   polled `${STAGING_APP_URL}/sk` and nothing else. A rolled host whose
   NestJS process died on boot (exactly API-1's failure mode) would have
   reported a successful deploy.
2. **Nothing exercised the API beyond liveness.** Even with `/api/health`
   polled, a process that answers the port but cannot reach the DB or has a
   broken DI graph would pass.
3. **Found while fixing 1–2 — the staging edge shadowed every Next.js
   `/api/*` route handler.** `nginx.staging.conf` sent `location /api/` to
   NestJS. The web app owns `/api/aps`, `/api/portal/*`,
   `/api/telehealth/sessions/*`, `/api/payments/receipt/*`, `/api/content`
   — the server-side proxies that turn the httpOnly `ns_patient_session`
   cookie into the `x-patient-session` header. NestJS uses the same prefixes
   (`api/portal`, `api/telehealth/sessions`, `api/payments`, `api/aps`), so
   they cannot be split by path. On a real staging host the portal,
   wearables tab, APS card and telehealth flows would have 401'd or 404'd.
   Never noticed because (see below) no staging host has ever existed.
4. **Also found: the staging web container had no `API_BASE_URL`.** The
   proxies default to `http://localhost:3001`, which inside the container is
   nothing. `docker-compose.production.yml` sets it; the staging compose did
   not.
5. **Also found: the CI smoke job could never run.** `ci.yml`'s
   `smoke-staging-guard` read `secrets.STAGING_APP_URL`, but the docs and
   `deploy-staging.yml` define the URLs as repository *variables*. With the
   host configured per the docs, the smoke job would have skipped forever.

### What changed

- `deploy-staging.yml`: three readiness rungs, each failing the deploy on
  its own — `GET /sk` → 200; `GET ${STAGING_API_URL}/api/health` → 200;
  smoke = `available-dates → slots` (a real Prisma query, so DB URL,
  migration state and the BookingModule DI graph are all on the line) plus
  `GET ${STAGING_APP_URL}/api/aps` carrying `x-ns-upstream: api`. The guard
  now writes a `::warning` and a job summary saying **nothing was deployed**
  when it skips, and *fails* if the host is set but either URL variable is
  missing (a web image built with an empty `NEXT_PUBLIC_API_URL` is not
  worth deploying).
- `apps/web/src/app/api/aps/route.ts`: sets `X-NS-Upstream: api` on the
  proxied path and `fallback` on the catch path. Needed because the NestJS
  APS service has its own `source: 'fallback'` body (PSK feed unset) that is
  byte-for-byte the shape of the handler's own fallback — the body cannot
  distinguish "API answered with its fallback" from "API unreachable".
- `nginx.staging.conf`: API moved to `location /backend/` with the prefix
  stripped (`proxy_pass http://api:4000/`). `STAGING_API_URL` is now the API
  *origin* (`https://<host>/backend`) as the code expects everywhere
  (`${NEXT_PUBLIC_API_URL}/api/…`). The docs' previous example
  `https://<host>/api` would have produced `/api/api/public/...` → 404 on
  every browser call. `/api/*` now reaches the Next.js handlers.
- `docker-compose.staging.yml`: `API_BASE_URL: http://api:4000` on `web`.
- `ci.yml`: smoke guard and job read `vars.STAGING_*_URL`.
- `scripts/smoke-test.mts`: the APS-proxy check requires
  `x-ns-upstream: api`; new `available-dates → slots` check.
- `docs/STAGING_DEPLOYMENT.md` updated to match.

### Verification (method, not outcome)

- Both workflows and the staging compose parse as YAML (`python3 -c
  'yaml.safe_load'`). `actionlint` is not installed here; no host exists to
  run the workflow against, so **the readiness gate is unexercised** until
  a `STAGING_HOST` is configured. The first real run is the test.
- `nginx -t` could not be run (Docker was down); the change is a one-line
  `location` + `proxy_pass` swap using the documented trailing-slash
  prefix-strip semantics, and is flagged here as syntax-unverified.
- `pnpm --filter=@ns/web typecheck` — clean. Smoke script:
  `pnpm exec tsc --noEmit --module nodenext --moduleResolution nodenext
  --target es2022 --lib es2022,dom --types node --typeRoots
  apps/api/node_modules/@types --strict scripts/smoke-test.mts` — the only
  error is the pre-existing dynamic import of `@google-cloud/translate`
  (line 211, not installed at the root; untouched by this change).

### Backfill — the blast radius

Checked with `gh run list` / `gh run view --json jobs` for every push to
`main` since the content merge `a1a4f57`. **`STAGING_HOST` has never been
set.** On every "Deploy — EU staging" run since the workflow landed
(2026-08-24, 13 runs), the only job that ran was `Check staging is
configured`; `Build & push images` and `Roll staging host` were **skipped**
and the workflow concluded "success" in 6–10 seconds. So:

| Push to `main` | Deploy workflow | What actually ran | CI conclusion (job that failed) |
|---|---|---|---|
| `a1a4f57` content merge | success | guard only — skipped | **failure** (Lint; E2E — API could not boot) |
| `e04b609` rename review-gate constant | success | guard only — skipped | **failure** (Lint; E2E — API could not boot) |
| `7f05626` CI cms-verify + MT guard | success | guard only — skipped | **failure** (Lint; CMS verify; E2E — API could not boot) |
| `4111a9f` cms-verify via npm; Lint fix | success | guard only — skipped | **failure** (E2E — API could not boot) |
| `c391d42` API-1 fix | success | guard only — skipped | **failure** (E2E — axe `link-in-text-block`, STG-2) |
| `98443d0` prose links underlined | success | guard only — skipped | success |

(`962b6c2`, `930f209`, `40f5c0e` were pushed together with `e04b609` and had
no run of their own.)

Two corrections to the record follow from this:

1. **No commit ever reported a successful staging deploy with a dead API,
   because no commit has ever been deployed to staging.** The API-1 entry's
   explanation ("reported success because it polls only the web route") is
   wrong and is marked so above. The `/sk`-only poll was real and would have
   produced exactly that false green on a real host; it just never got the
   chance.
2. **The green signal that was actually acted on was worse than a weak
   gate: it was a skip.** Four consecutive pushes had a **red CI** (Lint
   failed on three of them, so Build didn't even run; E2E failed on all
   four because the API could not boot) alongside a green deploy workflow.
   Anyone reading the deploy tick as "staging verified" was reading a no-op.
   The guard now says so in the run summary. The habit to keep: **a deploy
   workflow's conclusion is not a deploy verification — read the jobs.**

### Still open after STG-3

- **A staging host.** Everything above is unexercised until one exists
  (`docs/STAGING_DEPLOYMENT.md`, "What a human has to create").
- `infra/docker/Dockerfile.cms` still installs with pnpm (CI-1 note above).
- The Next.js `/api/*` ↔ NestJS `api/*` prefix collision is now routed
  around on staging; production uses a separate `api.` hostname and was
  never affected.

---

## PREVIEW-1 — web-only preview on Firebase App Hosting (2026-09-13)

At the user's direction ("we need to be able to see everything"), after
declining a billable GCE VM for the full stack. A backend
`nemocnica-snina-web` already existed in project `snina-nemocnica`
(created 2026-09-09 from the unmerged branch
`infra/firebase-app-hosting-preview`, commit `9e4940e`) and was still
serving that pre-ROUTE-1 build — `/sk/kariera`, `/sk/pre-pacientov`,
`/sk/o-nemocnici` all 404. Its config was ported to `main`
(`firebase.json`, `.firebaserc`, `apps/web/apphosting.yaml`), plus the two
platform-forced changes from that commit: `next` 15.1.3 → 15.1.12 (the
adapter blocks the CVE-flagged version) and `engines.pnpm` `>=9 <11`.
Lockfile refreshed; `pnpm --filter=@ns/web build` clean locally (327
static pages).

**Deployed `a00f5bf` + this config.** Verification against the live URL,
method named: 12 routes curl → 200 (all ROUTE-1 routes now present);
`data-nav` attribute present on `/sk` (UI-2b shipped); Playwright with a
temp config whose `baseURL` is the live host — `styled.spec.ts` §3 header
assertions for all 6 locales, the over-trigger and resize tests, the
prose-link underline test, and `a11y.spec.ts` axe on `/sk`, `/sk/kariera`,
`/sk/pre-pacientov`: 12 passed. `GET /api/aps` → `x-ns-upstream:
fallback`, expected (no API).

**What this is not:** the staging or production stack. No API/CMS/DB.
Deploys are manual (`firebase deploy --only apphosting`), not on push, so
the CI/deploy-workflow signal problem from STG-3 is unchanged: the only
automatic deploy path still targets a host that does not exist.

CI on `a00f5bf` (STG-3 + UI-2b pushed): all jobs green, `Integration smoke
— staging` skipped by the guard as designed.

---

## PREVIEW-2 — an orphaned preview backend nobody owned (found 2026-09-13)

While doing PREVIEW-1 the App Hosting backend `nemocnica-snina-web` turned
out to already exist: created 2026-09-09 from the branch
`infra/firebase-app-hosting-preview` (single commit `9e4940e`, never
merged, no reference anywhere on `main`, in the docs, or in project
memory), and **still serving that pre-ROUTE-1 build four days later** —
`/sk/kariera`, `/sk/pre-pacientov`, `/sk/o-nemocnici` all 404 on a public
URL. Same failure class as STG-3's false-green deploy: an environment
nobody owns, reporting nothing. Its config was ported to `main` and it
now serves `main` (PREVIEW-1).

**Inventory of project `snina-nemocnica` (Firebase CLI, 2026-09-13) — no
third state; each item is deleted or owned:**

| Resource | State found | Disposition |
|---|---|---|
| App Hosting backend `nemocnica-snina-web` (europe-west4) | stale, unowned | **Owned** — PREVIEW-1; config on `main`; manual deploy documented in `STAGING_DEPLOYMENT.md` |
| Secret `ns-web-preview-jwt-secret` | created 2026-09-13 | **Owned** — referenced from `apps/web/apphosting.yaml` |
| Classic Hosting site `snina-nemocnica` (`snina-nemocnica.web.app`), channel `live`, last release 2026-08-24 | serves "Site Not Found" (no content) | **Owned as the project's default site, empty.** Cannot be deleted (default site); nothing in the repo deploys to it — `firebase.json` has no `hosting` block. Nothing to take down. |
| Web app `Nemocnica Snina` (`1:512786960608:web:…`) | analytics app id used by `NEXT_PUBLIC_FIREBASE_*` | **Owned** (analytics only) |
| Cloud Functions | `functions:list` errors (API not enabled) — none | — |
| Git branch `infra/firebase-app-hosting-preview` (origin + local) | source of the orphan; fully superseded by `b217b43` | **Deleted** |
| Git stash on `feat/placeholder-media` ("firebase app hosting deploy config") | same content as the deleted branch | **Dropped** |

Not inventoried: `gcloud`-level resources (Cloud Run, Cloud SQL, GCE) —
`gcloud` calls were blocked by the session's permission classifier. App
Hosting is the only Cloud Run consumer this repo has ever configured, but
that is a statement about the repo, not the project; an owner with
console access should glance at Cloud Run and Compute once.

**Rule, stated:** anything that serves a URL has an owner and a line in
`STAGING_DEPLOYMENT.md`, or it is deleted. A preview created "to review a
branch" is deleted when the branch is.

---

## I18N-RUE T1 — Rusyn locale plumbing (2026-09-13)

Per the user's brief: no Prešov Rusyn medical copy is generated here.
What landed:

- **One locale list.** `packages/types` exports `LOCALES` (7, `rue`
  added) and `REVIEW_GATED_LOCALES` (`cs pl hu uk rue`); `Locale` is
  derived. `apps/web/i18n/config.ts` re-exports it; the 12 hardcoded
  6-locale literals (`content/route.ts`, `revalidate/route.ts`, three
  `generateStaticParams`, API `public.controller` `SUPPORTED`,
  `translation-gate.ts`, `admin/translations`, `i18n.spec.ts`,
  `styled.spec.ts`, CMS bootstrap + verify script) now derive from it or
  — in `apps/cms`, which has no workspace deps — mirror it with a comment.
  `grep` for `'sk', 'cs', 'pl'` in `apps/*/src` returns only the CMS
  mirror.
- **`rue.json`: full key structure, every value `""`.** The message
  merge treats `""` as untranslated and keeps the Slovak string, so `/rue`
  renders Slovak chrome today. `intlLocale()` maps `rue` → `sk-SK` for
  date/number formatting (Intl has no `rue` CLDR data), and gives
  `cs/pl/hu/uk` their own tags instead of the previous `en-GB`.
- **Translator worklist** `docs/RUE_TRANSLATION_WORKLIST.md`, generated by
  `pnpm --filter=@ns/web worklist:rue`: 253 keys open, split into chrome
  (fill first; gates the switcher entry), clinical/safety-critical
  (clinician-reader sign-off required, named in the commit) and other;
  plus the CMS-entry rule.
- **Review gate includes `rue`** on both layers (API `translation-gate`
  via `REVIEW_GATED_LOCALES`; CMS `index.js` mirror). The CMS bootstrap
  registers `rue` via the locales service (Strapi 4.25's ISO list lacks
  it); `verify-i18n-gate.js` now asserts 7 locales and that bootstrap
  created `rue`. MT: `MT_TARGET_LOCALES` default unchanged (`cs,pl,hu,uk`);
  the provider guard already throws on `rue`.
- **Collision assertion has its `rue` row** (`styled.spec.ts` §3).
- **Folded in:** `Dockerfile.cms` → npm (CI-1), and a latent
  `apps/api/jest.config.js` bug — the `@ns/types` mapper pointed two
  directories up instead of three, unexercised while the import was
  type-only.

Method: `pnpm typecheck` web + api + types clean; `audit:classes` 0
unknown; API tests `translation|public|app-module-di` 16 passed; web
`next build` 377 pages (327 before — `rue` adds 50) with `/rue` present;
Playwright against the dev server (DB-free temp config): `I1 [rue]` 200
+ brand; `I3` hreflang for all 7 locales; `styled.spec.ts` header row for
`/rue` and `/sk`; a probe asserting `<html lang="rue">`, `hreflang="rue"`
attached, every `.nav-top` label non-empty and Slovak ("Starostlivosť"
present — the `""` fallback works), and axe 0 critical/serious on `/rue`:
5 passed. CMS: `npm ci --workspaces=false` under Node 20 (the CI recipe,
1481 packages) then `verify:i18n`: 12/12 PASS, including "bootstrap
created the 7 locales (incl. rue)" and "content can be created in locale
rue".

**Not done (later Rusyn tasks):** T2 Literata for Cyrillic headings
(FONT-1), T4 the 7-endonym switcher (C5; `localeNames` is exported ready
for it), T5 `PRODUCTION_ARCHITECTURE.md` "7 languages" + `LAUNCH_CHECKLIST`
row. The `rue` switcher entry stays hidden until section 1 of the
worklist is filled.

