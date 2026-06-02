/**
 * Slovak rodné číslo (birth number) validation.
 * Modulo-11 algorithm as specified in PRODUCTION_ARCHITECTURE.md.
 * Format: YYMMDD/CCCC  (slash optional for input)
 */

export function validateRodneCislo(rc: string): boolean {
  // Strip slashes and whitespace
  const clean = rc.replace(/[\s/]/g, '');

  if (!/^\d{9,10}$/.test(clean)) return false;

  if (clean.length === 9) {
    // Pre-1954 — no check digit, basic format only
    return true;
  }

  // 10-digit: modulo-11 check
  const n = parseInt(clean, 10);
  if (n % 11 !== 0) return false;

  // Basic YYMMDD sanity (month can be +20 for women, +50 for exceptional)
  const year = parseInt(clean.substring(0, 2), 10);
  let month = parseInt(clean.substring(2, 4), 10);
  const day = parseInt(clean.substring(4, 6), 10);

  if (month > 50) month -= 50;
  if (month > 20) month -= 20;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  return true;
}
