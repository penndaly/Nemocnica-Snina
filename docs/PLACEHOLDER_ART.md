# Placeholder artwork layer (production)

Production implementation of the prototype's placeholder-art system
(`design_handoff_nemocnica_snina/PLACEHOLDER_ART.md` — read that first for the
design rationale; this doc covers what actually ships in `apps/web`).

**Purpose.** Until IMG-1 lands real photography, every hero and media slot
renders an on-brand illustrated scene instead of an empty frame, so the site
presents fully dressed. Landed in Sprint UI-1 (`feat/ui-hero-nav-art`,
2026-09-10).

## Where it lives
- `packages/ui/src/placeholder-art.ts` — `sceneFor(id)`, `sceneDataUri(name)`,
  `monogram(initials)`. 21 scenes, geometry ported verbatim from the
  prototype's `assets/placeholder-art.js`; **colours are not** — they come
  from this project's current (WCAG-AA-fixed) design tokens, not the
  prototype's own pre-fix copies of `--terra`/`--amber`/`--ink-3`. See the
  file's own header comment for the full reasoning.
- `packages/ui/src/components/HospitalImage.tsx` — the slot itself. Renders
  a real photo via `next/image` when a `photoUrl` is supplied; otherwise the
  generated SVG, with `data-placeholder-art` set so unphotographed slots stay
  queryable in the rendered DOM.
- `packages/ui/src/components/PageHero.tsx` — full-bleed hero band (image +
  scrim + overlaid copy) built on `HospitalImage`; used on every public route
  with a slot in the plan (see `assets/media.js`'s `PLAN` for the full slot
  list and per-route mapping — unchanged, still the source of truth for
  *which* slot goes on *which* route).

## Placeholder photography layer (MEDIA-1, 2026-09-13)

Above the art and below real photography sits a third layer: **32
licence-clean placeholder photographs** (sourced in IMG-0, every candidate
visually reviewed — no faces, no real institution branding; see
`docs/media/LICENSES.md`). They are resolved by `apps/web/src/lib/media.ts`
in this order:

1. **CMS** — Strapi collection `media-slots` (one row per hero slot:
   `image`, `hidden`, `placeholder`, `credit`, `licence`, `sourceUrl`,
   `reusedFrom`). The admin **replaces** the image, **hides** the slot
   (`hidden: true` → the illustrated art renders, no photo) or un-hides it.
   Department photos are `Department.image`; physician portraits stay
   `Physician.avatar`, real photos only — never a placeholder.
2. **Manifest** — `src/lib/media-manifest.json` + `public/img/*.webp`,
   bundled with the app so the preview (no CMS) shows photos too.
3. **Art** — the SVG scenes below.

Four hero slots had no photo of their own (IMG-0 gaps: every candidate
failed visual review) and **reuse** the closest sourced file — recorded in
`SLOT_ALIASES` and in each CMS row's `reusedFrom`: `home-campus` ←
`about-hero`, `patients-hero` ← `patients-room`, `contact-hero` ←
`news-hero`, `telehealth-hero` ← `teleconsult-hero`.

CC BY-SA files (`dept-chirurgia`, `dept-gynekologia`, `dept-oaim`) render
their attribution on-page (`PageHero` `credit` → `.hero-credit`).

Client-component pages (`objednanie`, `lekari`, `zverejnovanie`) resolve
from the manifest only (`staticHeroProps`); a CMS override for those three
heroes needs a server wrapper — not done. Guard: `pnpm --filter=@ns/web
check:media` (CI lint) fails if any `PageHero` slot has no photo, a file is
missing, alt sk/en is absent, a weight budget is exceeded, or a `doc-*`
entry appears. Seeding: `apps/cms/seed/import-seed.ts` uploads the files to
the media library and creates the rows (idempotent).

**Go-live rule:** no `placeholder: true` slot may remain visible
(`LAUNCH_CHECKLIST.md`). Replacing a placeholder with a real photo = upload
in the CMS row and untick `placeholder`.

## A real photo always wins
`HospitalImage` checks `photoUrl` first, full stop — there's no separate
"remove the placeholder" step. Once a real photo is available (CMS media
field, once that pipeline exists — `next.config.ts`'s `images.remotePatterns`
is still an empty placeholder pending the Strapi URL), pass it in and the
generated art stops rendering automatically, no code change needed at the
call site.

## No faces, no institution names
Same constraint as the prototype, restated because it's a compliance
requirement, not a style preference: the IMG-0 sourcing sprint found that
roughly 40% of licence-clean stock candidates leaked a real institution's
signage or an identifiable face. The generated art sidesteps this entirely —
`person()` draws head-and-shoulders silhouettes with no facial detail, and
`monogram()` renders initials rather than a face for physician avatars.

## Every media field has an art fallback
See `design_handoff_nemocnica_snina/DATA_MODEL.md`'s media-fields note: an
unpopulated media field is a *presentation-complete* state, not a broken
one. Don't add loading spinners, "image missing" states, or null checks that
treat an empty media field as an error condition — `HospitalImage` already
handles it, and the placeholder is intentional design, not a bug.

## Related
- Design rationale + full scene table + palette rule:
  `design_handoff_nemocnica_snina/PLACEHOLDER_ART.md`
- Slot plan / per-route hero mapping: `design_handoff_nemocnica_snina/assets/media.js`
- Hero contrast dependency (the 62% copy cap): `docs/03-AUDIT.md`
- Real photography sourcing, licences, known gaps: `assets/img/README.md` on
  `feat/placeholder-media` (not merged here)
