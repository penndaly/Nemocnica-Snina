/**
 * Slug generator — a verbatim port of ADMIN.slugify() from
 * design_handoff_nemocnica_snina/assets/admin.js.
 *
 * Parity is a Sprint A1 non-negotiable: the CMS write API and the prototype
 * admin must produce identical slugs for the same input, so a record created
 * in either place resolves to the same canonical URL.
 *
 * Algorithm (order matters — lowercase BEFORE NFD, exactly as the prototype):
 *   1. coerce to string, default "item"
 *   2. lowercase
 *   3. NFD normalise + strip combining diacritics (č→c, š→s, ž→z, á→a …)
 *   4. collapse runs of non-alphanumerics to a single hyphen
 *   5. trim leading/trailing hyphens
 *   6. cap at 28 chars
 *   7. fall back to "item-<timestamp>" if the result is empty
 */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function slugify(s: string | null | undefined): string {
  return (
    (s || 'item')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(COMBINING_MARKS, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 28) || `item-${Date.now()}`
  );
}
