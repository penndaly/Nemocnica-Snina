# Audit notes

Running log of findings that need to survive past the sprint that found them —
things a future change is likely to break without realizing it.

## Hero copy contrast depends on the 62% width cap (Sprint UI-1, 2026-09-10)

`packages/ui/src/globals.css`'s `.has-hero-media` rule:

```css
@media (min-width: 1101px) {
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

**Anyone changing the hero layout must re-run a contrast probe** (hero `h1`,
`.lede`, `.breadcrumb`, `.chip` text, and on `/objednanie` every stepper
label) at 1101px+ before shipping, specifically if:
- the scrim gradient direction, stops, or opacity change;
- a new full-width hero variant is added (the current exemption list is only
  `.hero-grid` — home's two-column layout, which is itself narrower than the
  viewport by design — and `.stepper`, the booking wizard's step indicator);
- hero copy is allowed to grow past `min(64ch, 62%)` for any route.

This wasn't machine-verified for Sprint UI-1 itself — the project's axe/
Playwright a11y suite (`apps/web/e2e/a11y.spec.ts`) requires a live Postgres
instance (`global-setup.ts` wipes test data via Prisma before every run),
which wasn't available in the environment that built this sprint. The values
above are an unmodified port of the prototype's own already-scrim-tuned
numbers (`design_handoff_nemocnica_snina/assets/styles.css`), not new
guesses — but "ported from a source that claims to hold 4.5:1" and
"machine-verified to hold 4.5:1 in this codebase" are not the same claim.
Whoever has a working Postgres instance next should run:

```
pnpm --filter @ns/web test:e2e -- a11y.spec.ts
```

and specifically check the "renders at 130% text scale without horizontal
scroll" and the per-route axe-violation tests, plus a manual contrast probe
of the elements listed above (axe's own `color-contrast` rule is disabled in
that suite — checked separately, per the file's own comment — so a clean axe
run does not by itself confirm this).
