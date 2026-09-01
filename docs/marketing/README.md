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
- `img/` — the named screenshots the page references.
- `final/` — the full set of final captures.

**Anonymization.** The screenshots were captured from the prototype with a
DOM-level anonymizer applied: no real patient or staff identifiers appear in
any asset. The copy uses only generic terms ("a regional hospital", "the
district"). Before this material was committed, the HTML, the image filenames
and the PNG metadata/text chunks were checked against the real client name,
the real clinician roster from the seed data, real phone numbers and the demo
patient identity — zero matches. If screenshots are ever re-captured from the
product, re-run the anonymizer first and repeat that check; a hit means
re-capturing, not editing.

## Brand assets

`/assets/pixel-perfekt-logo.png` is the parent-company mark (Pixel Perfekt
Media lockup, for light backgrounds) — use it for future collateral built from
this repository.
