# Marketing & reference material

Anonymized marketing/reference assets kept alongside the codebase. **Nothing in
this directory (or in `/assets`) is wired into any app build — it must never
ship as a public route of the Next.js app.**

## Case study — Regional hospital platform

`case-study-regional-hospital-platform/` holds the anonymized case study used
by the parent company (Pixel Perfekt Media) for sales:

- `regional-hospital-platform-standalone.html` — the case study as a
  self-contained standalone export (JS-rendered; open it directly in a
  browser). It loads its screenshots from the sibling `img/` folder, so keep
  the folder structure intact.
- `img/` — the screenshots the page references. Captured from
  `design_handoff_nemocnica_snina/admin.html` (the actual capture source —
  not the live Next.js `/admin` app, which has since diverged visually) via
  `apps/web/scripts/capture-case-study-screenshot.mjs`, which masks both
  bilingual input/textarea values and rendered text before screenshotting.

**Anonymization — what was actually verified, and how (2026-09-02, 12
published images).** None of these checks alone would have caught
everything; they're layered because each one only sees part of the surface:

1. **Text grep** over the standalone HTML and this README: the Slovak `rodné
   číslo` pattern, an SK mobile-phone pattern, an email pattern, all 14
   physician names from `assets/data.js`'s `SEED.physicians` (extracted
   programmatically, not typed by hand), and the E2E patient-fixture
   placeholder names — zero matches. This only covers literal text in the
   HTML/markdown files themselves, not anything baked into image pixels.
2. **Image metadata** — EXIF tags and PNG `tEXt` chunks on every image, via
   Pillow and macOS `sips` — zero tags on any of the 27 images (screenshots +
   the brand logo).
3. **OCR over every published screenshot**, against the same name/pattern
   list from (1) plus the town/hospital-name term list (`Snina`, `Sniny`,
   `Snine`, `Sninu`, `Sninou`, `sninsk*`, `Nemocnica Snina`, `Nemocnice
   Snina`, `NsP Snina`, case-insensitive) — zero matches on all 12. This is
   the check that actually catches what's rendered into the pixels, which
   (1) and (2) structurally cannot — see `## Re-verifying` below to re-run
   it; it's a manual step, not part of any automated pipeline.
4. **Manual visual review** of all 9 screenshots the standalone HTML
   actually embeds (`01`, `02`, `03`, `04`, `07`, `08`, `09`, `11`, `12`).

If screenshots are ever re-captured, re-run all four checks — a hit means
fixing `apps/web/scripts/capture-case-study-screenshot.mjs`'s mask map and
re-capturing, not editing the image. See `CHANGELOG.md` for what step 3
actually caught the one time it mattered.

## Re-verifying (OCR gate)

Not part of any CI job — a manual step to run before shipping new/changed
screenshots. No OCR tool is committed to this repo (the check that produced
the "12 published images" result above used a small macOS Vision-framework
script, kept locally, not checked in). Portable equivalent using
[tesseract](https://github.com/tesseract-ocr/tesseract) (`brew install
tesseract` / `apt install tesseract-ocr`):

```bash
for f in docs/marketing/case-study-regional-hospital-platform/img/*.png; do
  tesseract "$f" - 2>/dev/null
done | grep -oiE '\bsnin[a-z]*\b|\b[0-9]{6}/?[0-9]{3,4}\b|(\+421|00421|0)\s?9[0-9]{2}[\s-]?[0-9]{3}[\s-]?[0-9]{3}'
# also check against the current physician-name list:
node -e "
  const fs = require('fs');
  const src = fs.readFileSync('design_handoff_nemocnica_snina/assets/data.js', 'utf8');
  const m = src.match(/physicians:\s*\[([\s\S]*?)\n  \],/);
  for (const n of [...m[1].matchAll(/name:\s*\"([^\"]+)\"/g)]) console.log(n[1]);
"
```

Any output from the grep line, or any physician name appearing in the OCR
text, is a hit — fix the mask map and re-capture, don't edit the image.

## Brand assets

`/assets/pixel-perfekt-logo.png` is the parent-company mark (Pixel Perfekt
Media lockup, for light backgrounds) — use it for future collateral built from
this repository.
