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

This still wasn't machine-verified end-to-end for Sprint UI-1 — the
project's axe/Playwright a11y suite (`apps/web/e2e/a11y.spec.ts`) requires a
live Postgres instance (`global-setup.ts` wipes test data via Prisma before
every run), which wasn't available in the environment that built this
sprint. The 781/780px pairing above was confirmed by rendered DOM width at
780/781/900/1100/1101px (the cap now visibly engages at exactly 781px,
where it previously didn't engage until 1101px) — that confirms the cap
*applies*, not that the resulting text-on-photo ratio *clears 4.5:1* for
every hero image; that still needs the real contrast probe. Whoever has a
working Postgres instance next should run:

```
pnpm --filter @ns/web test:e2e -- a11y.spec.ts
```

and specifically check the "renders at 130% text scale without horizontal
scroll" and the per-route axe-violation tests, plus a manual contrast probe
of the elements listed above (axe's own `color-contrast` rule is disabled in
that suite — checked separately, per the file's own comment — so a clean axe
run does not by itself confirm this).
