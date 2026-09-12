# Sprint I18N-RUE — Rusyn (7th locale) — SCOPE, not yet built

Scoped 2026-09-12 on `main` `a1a4f57`. This is the pre-build scope the user
asked for. Nothing below is implemented; the "Calls needed" section blocks
the build. Verification method for every task is named up front, per the
standing rule in `CLAUDE.md` (method, not outcome).

## What "7 locales" resolved to

The 6 existing locales (`sk, cs, pl, hu, uk, en`) **plus Rusyn = 7**. There
was no other candidate: `PRODUCTION_ARCHITECTURE.md` §Multilingual lists
exactly those 6, every hardcoded list in the repo has the same 6, and no
handoff doc mentions any seventh language. Locale code: **`rue`** (ISO 639-3,
the only code Rusyn has — there is no 2-letter ISO 639-1 code; `rue` is a
valid BCP-47 tag for `hreflang`, `<html lang>`, `Intl`). Script: Cyrillic,
Prešov Rusyn standard (the variety spoken in the Snina region), whose
alphabet needs `ґ є ї і ы ё ъ` on top of the basic Cyrillic block — all
inside U+0400–045F, i.e. covered by any font's "cyrillic" subset.

## Why this is more than adding a code to a list — three pre-existing defects found while scoping

These are logged in `docs/03-AUDIT.md` (CMS-1, FONT-1, UI-3). Rusyn cannot be
shipped honestly on top of them; the first two also already affect `uk`.

1. **CMS-1 — Strapi i18n is not enabled on any collection.** All 20 schemas in
   `apps/cms/src/api/*/content-types/*/schema.json` spell the option
   `"pluginsOptions"` (extra `s`). Strapi's key is `pluginOptions`, so every
   `"i18n": { "localized": true }` is silently ignored and every collection
   is single-locale. The bootstrap creates the 6 locale rows and the publish
   gate is registered, but there is no localized content for them to gate.
   Additionally, **Strapi 4.25.0's bundled ISO locale list (603 entries) has
   no Rusyn entry** — verified against the published `@strapi/plugin-i18n`
   4.25.0 bundle: no `rue`, no "Rusyn". The admin UI's "add locale" picker
   only offers list entries. The bootstrap path (`i18nService.create`) is a
   service call, not the validated admin controller, so it *probably* accepts
   `rue` — **unverified**: Docker was down locally and the CMS's dependencies
   are not installed, so Strapi could not be booted. Fallback if it rejects:
   `patch-package` the list. Either way this is locale plumbing beyond a
   config addition — flagged, per the brief.

2. **FONT-1 — `Newsreader` (all headings, `h1–h3`) has no Cyrillic.** Google
   Fonts serves it with `latin`, `latin-ext`, `vietnamese` subsets only;
   `Mulish` (body/UI) does ship `cyrillic` + `cyrillic-ext`. Confirmed in the
   browser by width comparison, not by `document.fonts.check` (which returns
   true when no face covers the text): "Відділення лікарні" at 40px measures
   406.6px in the `Newsreader, Georgia, serif` stack vs 408.2px in plain
   Georgia (fallback), while Latin text measures 383px vs 445px (real
   Newsreader). **Every `uk` heading already renders in Georgia today**,
   silently. Rusyn would too.

3. **UI-3 — grouped header collides with its CTAs at desktop widths.** The
   nav's last group label overlaps the first CTA button: in `uk` at
   **1101, 1280 and 1440px** (last group right edge 1030px vs CTA left 938px
   at 1440), and in `sk` at the 1101px collapse boundary (819 vs 781).
   Screenshots taken. It never showed in the no-scroll ladder because the
   overflow is *inside* the header box — same blind spot as ROUTE-1b. The
   user's flagged risk ("group labels are the longest strings; check them at
   every locale before assuming the header fits") is already real, before any
   seventh locale.

Also found, not blocking but relevant to what Rusyn will look like on day one:

- **The language switcher only exposes `sk` and `en`.** `cs/pl/hu/uk` are
  reachable by URL and `hreflang` only. For a *recognized minority language
  with a genuine access requirement*, URL-only discoverability is not
  acceptable — Rusyn must be in the switcher. Seven inline buttons do not fit:
  at 375px the utility bar is 169px (phones) + 142px (a11y controls + 2
  buttons); 7 buttons ≈ +180px → overflow. So the switcher needs a redesign.
- **`cs/pl/hu/uk` message files carry 93 of 253 keys** (`booking`, `portal`,
  `telehealth`, `room`, `wearables`, parts of `footer`/`nav`/`navGroups`
  missing); `i18n/request.ts` deep-merges over `sk`, so those pages show
  Slovak chrome. Rusyn will start in the same state and that is acceptable
  only if it is visible and tracked.
- **No machine-translation provider supports Rusyn** (DeepL — the planned
  `MT_PROVIDER` — does not; neither does Google). The MT pipeline's
  `MT_TARGET_LOCALES` defaults to `cs,pl,hu,uk` and must *not* include `rue`.
  Rusyn content is human-translated by definition. The draft gate still
  applies (the brief says so, and the code path is the same): add `rue` to
  `MACHINE_TRANSLATED_LOCALES` (API) and `MACHINE_LOCALES` (CMS hook) so no
  Rusyn clinical entry can publish without `review_status='approved'`. The
  name of that constant becomes wrong; rename to `REVIEW_GATED_LOCALES`.
- **`Intl` has no `rue` CLDR data** — dates/numbers fall to the root locale
  ("2026-09-12", "1,234.5"). Regional convention in Slovakia is `12. 9. 2026`
  and `1 234,5`. Map `rue` → `sk` for formatting only.

## Calls needed before building (answer these; the rest is mechanical)

| # | Call | Recommendation |
|---|---|---|
| C1 | **Who supplies the Rusyn strings?** 253 UI keys + clinical content. I will not generate Prešov-Rusyn medical copy myself: it is a low-resource minority language, healthcare wording, and a legal access requirement — a wrong rendering is worse than a Slovak fallback. | Ship the plumbing with a structured `rue.json` (all 253 keys, empty → `sk` fallback via the existing merge) plus a translator worklist (`docs/RUE_TRANSLATION_WORKLIST.md`, key → sk → en). Rusyn switcher entry goes live only once nav/footer/home keys are filled. |
| C2 | **CMS-1 first, as its own sprint?** Fixing `pluginsOptions` re-enables i18n on 20 collections and changes Strapi's tables (adds `locale` + `localizations` link tables; existing rows become `sk`). Needs a booted Strapi against Postgres to verify, which this environment could not do. | Yes — a separate `CMS-1` pre-sprint, run where Docker is up. Rusyn's CMS locale registration (`rue` via bootstrap, or the patch) is verified in the same run. Do not start I18N-RUE's CMS task until CMS-1 is green. |
| C3 | **Heading font for Cyrillic.** Options: (a) add a Cyrillic-capable serif *after* Newsreader in the stack so only Cyrillic glyphs fall to it — `Literata` (Google Fonts, optical-size axis like Newsreader, `cyrillic` subset) or `Source Serif 4`; (b) switch all headings to one Cyrillic-capable face; (c) accept Georgia. | (a) with **Literata**: Latin unchanged, Cyrillic gets a designed transitional serif instead of a system fallback, one extra font request only on `uk`/`rue`. Verified by the width-comparison probe in `styled.spec.ts`, per locale. Design owner should eyeball it. |
| C4 | **Header collision fix (UI-3).** (a) content-aware collapse: measure `.nav-links` and switch to the hamburger when it would overlap, instead of a fixed 1100px; (b) shorten/iconify CTAs on long locales; (c) raise the breakpoint per locale via a CSS class on `<html>`. | (a). It is the only option that stays correct for whatever a translator returns. Add a per-locale assertion "last `.nav-top` right edge < first CTA left edge" at 1101/1280/1440 to `styled.spec.ts` — that assertion, not the ladder, is what catches this. |
| C5 | **Language switcher shape.** (a) dropdown/`<select>` of 7 native names (Slovenčina, English, Русиньскый, Čeština, Polski, Magyar, Українська); (b) 3 buttons `SK EN RUE` + "more" menu; (c) keep 2 + add Rusyn = 3 buttons only. | (a). Fixes the existing discoverability gap for 4 locales at the same time, fits at 320px, and native names are the a11y norm (`lang` attribute per option). |
| C6 | **`rue` vs `rue-SK`.** | `rue`. No competing region needs disambiguation; shorter URLs; `hreflang="rue"` is valid. |

## Build plan (once calls are in) — one commit per task, method named

- **T1 Locale plumbing, single source of truth.** There are **12 hardcoded
  6-locale lists** (`i18n/config.ts`, `packages/types` `Locale`, `middleware`,
  `api/content/route.ts`, `api/revalidate/route.ts`, `generateStaticParams`
  in `oddelenia/[slug]`, `edukacia/[slug]`, `kariera/[slug]`,
  `apps/api public.controller` `SUPPORTED`, `translation-gate`,
  `admin/translations` `LOCALES`, `e2e/i18n.spec.ts`, plus `apps/cms`
  `plugins.js` + `index.js`). Collapse the web ones onto `locales` from
  `i18n/config.ts`, the API ones onto `@ns/types`; add `rue`; `rue.json`
  skeleton; `Intl` formatting map `rue→sk`; `MT_TARGET_LOCALES` excludes
  `rue`; review gate includes it (both layers, tests updated). *Method:*
  `pnpm typecheck` (web+api), `translation-gate.test.ts` extended with `rue`,
  `i18n.spec.ts` I1/I3 at 7 locales, `grep` proving no 6-locale literal
  remains.
- **T2 Fonts (C3).** Stack change in `globals.css` + Google Fonts import;
  *method:* width-comparison probe in `styled.spec.ts` on `/uk` and `/rue`
  h1 (Cyrillic width ≠ Georgia width), plus Latin unchanged on `/sk`.
- **T3 Header (C4, fixes UI-3).** *Method:* per-locale collision assertion at
  1101/1280/1440 in `styled.spec.ts`, screenshots for `uk`, `sk`, `rue`; no-
  scroll ladder unchanged. **Landed ahead of this sprint as UI-2b
  (2026-09-12, `docs/03-AUDIT.md` "UI-2b close-out").** For Rusyn only the
  `rue` row of the assertion and its screenshot remain.
- **T4 Switcher (C5).** *Method:* computed style + ladder at 320–1440, axe
  gap noted (still no local axe), keyboard operation in `a11y.spec.ts`.
- **T5 Docs.** `PRODUCTION_ARCHITECTURE.md` "7 languages"; `LAUNCH_CHECKLIST`
  i18n row (Rusyn content signed off by a named reviewer); `03-AUDIT.md`
  close-outs; translator worklist. No DPIA change: Rusyn adds no data
  category.
- **CMS-1 (separate, C2)** precedes T1's CMS half.

## Explicitly out of scope

Filling `cs/pl/hu/uk`'s 160 missing keys (same worklist mechanism, separate
content task); UI-2 (320px floor); any Rusyn clinical content authoring.
