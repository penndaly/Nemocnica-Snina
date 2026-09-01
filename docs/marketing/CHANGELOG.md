# Changelog — marketing/reference material

## 2026-09-02 — `final/` removed; `img/12-admin-page-content.png` re-captured

**`docs/marketing/case-study-regional-hospital-platform/final/`** (14 raw
captures, never referenced by the published standalone HTML) was removed
entirely rather than fixed. Nothing in the repo used it — the HTML only ever
loaded images from the sibling `img/` folder — and a visual + OCR review
found it was never actually anonymized despite the case study's original
commit message claiming otherwise: it showed the real hospital name, real
physician names from the seed data, a real switchboard phone number, and a
synthetic patient ID matching the Slovak `rodné číslo` pattern.

**`img/12-admin-page-content.png`** leaked the real town name ("Sniny") in
a Slovak-language subtitle field. Root cause: the original capture's mask
step correctly rewrote the *English* copy of that field ("Snina" → "the
district") but never touched its *Slovak* counterpart — a gap that text
grep and image-metadata checks structurally cannot see, since the leaked
text was only ever present as rendered pixels, not in the HTML or any file
metadata. Caught by an OCR pass over the published screenshots.

Re-captured with a fixed, per-language mask (`apps/web/scripts/
capture-case-study-screenshot.mjs`) — the earlier attempt at a fix used one
replacement string for both languages, which produced grammatically broken
output ("mesta the district", "the district district"); the current script
uses distinct, grammar-checked replacements per language instead.
