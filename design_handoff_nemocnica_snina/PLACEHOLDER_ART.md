# Placeholder artwork layer (`assets/placeholder-art.js`)

**Purpose.** Until IMG-1 lands real photography, every declared image slot renders
an on-brand illustrated scene instead of an empty "drop an image" frame, so the
site presents fully dressed. Added 2026-09-10.

## How it works
- `media.js` declares the slot plan and mounts `<image-slot>` elements (unchanged).
- `placeholder-art.js` loads **after** `media.js`, walks every `<image-slot>` with
  no `src`, and sets a generated inline SVG data-URI.
- A real photo always wins: `image-slot` prefers the user-dropped/stored image
  over the `src` attribute, so dropping a photo (or, in production, setting the
  CMS media field) replaces the artwork with no code change.
- Slots filled this way carry `data-placeholder-art` — a one-selector way to
  audit which slots are still unphotographed.

## Scene mapping
`sceneFor(id)` resolves a slot id to one of the scenes below. Explicit ids are in
`MAP`; department cards resolve via `DEPT` (`dept-<id>`); physician avatars
(`doc-<id>`) render a **monogram** built from the card's initials, coloured from a
6-way palette hash — deliberately not a faceless portrait silhouette.

| Scene | Used for |
|---|---|
| `campus` | home & about heroes, generic hero fallback |
| `aerial` | contact hero |
| `corridor` | departments hero, discharge, ward rounds |
| `ward` / `nurse` | inpatient rooms, nursing care, services |
| `consult` | physician consultation, neurology |
| `team` | physicians & careers heroes |
| `equipment` | diagnostics equipment, surgery, OAIM, investment |
| `lab` | laboratory / biochemistry / haematology |
| `imaging` | CT-RTG suite, orthopaedics |
| `pharmacy` | hospital pharmacy |
| `waiting` | outpatient clinics hero |
| `reception` | admissions, patients hero |
| `video` | telehealth / teleconsult |
| `archive` | hospital history (sepia treatment) |
| `education` | patient education, training |
| `news` / `docs` | news page, disclosure documents |
| `admin` | administration building |
| `booking` | booking flow hero |

## Palette
Scenes are drawn only from `styles.css` tokens (medical blue, warm cream/sand,
terracotta, green, amber). No new colours, no gradients beyond the single `sky`
linear gradient, no faces or identifiable detail — nothing that could be mistaken
for a real person or a real institution.

## Hero ratio
Every page now opens with a **full-bleed hero image directly below the navigation**,
with the breadcrumb, eyebrow, headline, lede, chips and any buttons overlaid on it.
`mountHero()` injects `.hero-media` + `.hero-scrim` as the first children of
`.page-hero` (or `.hero-wrap` on the home page) and adds `.has-hero-media`.

- The scrim is a left-to-right navy gradient (.93 → .22). Hero copy is capped at
  `min(64ch, 62%)` on desktop so text never crosses into the light half — that is
  what keeps it above 4.5:1. On mobile the gradient switches to vertical.
- Cards sitting inside a hero (the home emergency card) keep their own ink; the
  overlay colour rules are reset for `.card` descendants.
- The department detail page resolves its hero per department (`dept-<id>-hero`).
- If you add buttons to a hero, use `.btn-primary` or `.btn-ghost` — the ghost
  variant is restyled for dark ground inside `.has-hero-media`.

The earlier separate `.media-hero-band` under the hero copy is gone.

## When IMG-1 lands
1. Populate the slot via the CMS media field (or drop the file in the prototype).
2. Nothing to remove — the artwork is only a fallback. Delete a scene from `MAP`
   only if the slot itself is retired.
3. `document.querySelectorAll('image-slot[data-placeholder-art]')` lists what is
   still unshot; that is the live version of the Known Gaps list.

## Related
- Slot plan and CMS field mapping: `assets/media.js`
- Photography sourcing rules, licences, and the 8 known gaps: repo
  `assets/img/README.md` on `feat/placeholder-media`
