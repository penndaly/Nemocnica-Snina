# Image slots — inventory, ratios, budgets

Companion to `IMG_1_PLACEHOLDER_PHOTOGRAPHY.md` (sourcing rules, per-slot
search terms) and `assets/img/index.json` (the actual manifest). This file
is the slot inventory + technical spec; the sourcing brief is *what to look
for*, this is *what to build*.

## Budgets

| Tier | Long edge | Weight budget (AVIF) |
|---|---|---|
| Hero (`*-hero` ids, full-bleed band under the page hero) | 2400 px | ≤ 400 KB |
| In-page (gallery/section photos, `dept-<id>` cards) | 1600 px | ≤ 250 KB |

Never upscale — if a candidate's long edge is below the target, reject it
and pick another source (`assets/img/process-one.mjs` enforces this and
refuses to process an undersized source).

## Slot inventory (2026-09-08)

Built from `assets/media.js`'s `PLAN` object (33 slots: 16 hero + 17
in-page) plus `dept-<id>` for each of `SEED.departments`'s 7 ids
(`design_handoff_nemocnica_snina/assets/data.js`) — **40 slots total**.
`doc-<id>` (14 physician portraits) are deliberately **not** part of this
inventory — they stay empty placeholders until real, signed-release staff
photos arrive (IMG_1 §2).

Ratio comes from `media.js` PLAN per slot (default `21/6` for heroes not
otherwise specified, `4/3` for `dept-<id>` grid cards).

| Slot ID | Ratio | Status |
|---|---|---|
| `home-campus` | 21/6 | gap — see `assets/img/README.md#known-gaps` |
| `about-hero` | 21/6 | sourced |
| `patients-hero` | 21/6 | gap |
| `careers-hero` | 21/6 | sourced |
| `education-hero` | 21/6 | sourced |
| `departments-hero` | 21/6 | sourced |
| `clinics-hero` | 21/6 | sourced |
| `diagnostics-hero` | 21/6 | sourced |
| `services-hero` | 21/6 | sourced |
| `physicians-hero` | 21/6 | sourced |
| `news-hero` | 21/6 | sourced |
| `contact-hero` | 21/6 | gap |
| `telehealth-hero` | 21/6 | gap |
| `booking-hero` | 16/9 | sourced |
| `teleconsult-hero` | 16/9 | sourced |
| `disclosure-hero` | 16/9 | sourced |
| `home-care-1` | 4/3 | sourced |
| `home-care-2` | 4/3 | sourced |
| `home-care-3` | 4/3 | sourced |
| `about-history` | 16/9 | gap (resolution — see below) |
| `about-invest` | 16/9 | gap |
| `patients-admission` | 16/9 | gap |
| `patients-pharmacy` | 16/9 | sourced |
| `patients-room` | 4/3 | sourced |
| `patients-visit` | 4/3 | sourced |
| `patients-nurse` | 4/3 | sourced |
| `patients-discharge` | 21/8 | gap |
| `careers-1` | 4/3 | sourced |
| `careers-2` | 4/3 | sourced |
| `careers-3` | 4/3 | sourced |
| `diag-1` | 4/3 | sourced |
| `diag-2` | 4/3 | sourced |
| `diag-3` | 4/3 | sourced |
| `dept-chirurgia` | 4/3 | sourced (re-sourced at higher resolution) |
| `dept-interne` | 4/3 | sourced |
| `dept-gynekologia` | 4/3 | sourced |
| `dept-pediatria` | 4/3 | sourced |
| `dept-neonatologia` | 4/3 | sourced |
| `dept-oaim` | 4/3 | sourced |
| `dept-fro` | 4/3 | sourced |

**32 of 40 sourced, 8 gaps.** Every gap here failed a *visual* review, not
a licence check — see `## Known gaps` below and `docs/media/LICENSES.md`'s
own history for what "sourced" actually required. An honest gap beats a
wrong image (IMG_1 §5 step 2) — do not fill one of these with the first
candidate that clears the licence check alone; re-run the same visual
review (identifiable faces, real facility branding, resolution) before
marking a slot sourced.

## Known gaps

8 remain, after two sourcing passes (40 → 20 sourced → 32 sourced). Every
one failed a *visual* review of the actual downloaded image, not a licence
check — the pattern throughout this sprint: text-based search/licence
checks cannot see what's baked into an image's pixels (a real facility's
name on a wall, a face, a resolution below target), only looking at the
file can. `dept-chirurgia` was in this list after the first pass
(1237×705, below the 1600 px minimum) and is now sourced — a second,
higher-resolution Commons candidate (3264×2448) cleared review.

| Slot | Why it's still a gap |
|---|---|
| `home-campus` | Every candidate found either duplicated `about-hero`'s photo (same photographer/shoot) or was a specific, identifiable real (non-Snina) hospital — Trnava Hospital and, on the second pass, a repeat of the same building. |
| `patients-hero` | Every search converged on the same Pexels photo with "Pulpatta Medical Centre" signage on the wall — tried twice, same result both times. |
| `contact-hero` | No true aerial hospital-campus shot exists in the allowed sources that isn't a specific, named real institution (Walter Reed Medical Center, then a "Children's Hospital / London Health Sciences Centre" rooftop sign). |
| `telehealth-hero` | Every candidate's on-screen "doctor" face is sharp and legible enough to read as a real physician — the concept (video call with a visible doctor) is inherently hard to satisfy with the identifiability rule. |
| `about-history` | No Snina-specific or even Slovak-hospital archival photo exists on Wikimedia Commons (confirmed by an exhaustive Commons category search). The best substitute found — a real 1921 photo of a *different* Slovak hospital, honestly disclosed as such — was only 896×602, below the 1600 px minimum. Upscaling was rejected per the no-upscale rule. |
| `about-invest` | First candidate was too dark/moody with German warning signage; the re-search's candidate was an obvious sci-fi movie-prop set ("ALERT" gauge, fake vitals readout), not a plausible hospital room. |
| `patients-admission` | First candidate had a dental clinic's branding; the re-search's candidate had a different clinic's Cyrillic branding ("Маяк Здоровья" — a real, named medical centre). |
| `patients-discharge` | The only candidate clearing the identifiability/branding bar (an empty corridor with a distant wheelchair) is lit like a horror film — a genuine mood/quality mismatch, not a compliance issue, but wrong enough to skip rather than ship. |

If re-sourcing any of these, the framing guidance that worked well
elsewhere: hands/equipment/back-of-head/empty-room only for anything
involving people (IMG_1 §2); for `home-campus`/`contact-hero`, an
unbranded, non-iconic building — nothing architecturally distinctive
enough to be reverse-image-searched to a real institution.

## Re-sourcing

Use the same pipeline as the first pass: find a candidate (search terms in
`IMG_1_PLACEHOLDER_PHOTOGRAPHY.md` §3), download to a scratch path, run
`node assets/img/process-one.mjs <slotId> <rawPath> <ratio> <longEdge>
<budgetKB>` (rejects undersized sources automatically), **look at the
processed output before adding it to `index.json`** — the resolution/budget
checks are automatic, the identifiability/branding checks are not.
