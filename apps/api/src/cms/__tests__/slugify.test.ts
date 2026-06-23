import { slugify } from '../slugify';

/**
 * Parity with ADMIN.slugify() (design_handoff/assets/admin.js). These expected
 * outputs were captured from the prototype algorithm verbatim.
 */
describe('slugify — ADMIN.slugify() parity', () => {
  it('strips Slovak diacritics and lowercases', () => {
    expect(slugify('MUDr. Jana Borščová')).toBe('mudr-jana-borscova');
    expect(slugify('Žltý kôň ščč')).toBe('zlty-kon-scc');
  });

  it('caps at 28 chars AFTER trimming (trailing hyphen from the cut is kept)', () => {
    // 'Chirurgicko-traumatologické oddelenie' → cut at 28 chars
    expect(slugify('Chirurgicko-traumatologické oddelenie')).toBe('chirurgicko-traumatologicke-');
    expect(slugify('Fyziatricko-rehabilitačné oddelenie (FRO)')).toBe('fyziatricko-rehabilitacne-od');
  });

  it('collapses runs of non-alphanumerics to single hyphens and trims edges', () => {
    expect(slugify('  Hello --- World!!!  ')).toBe('hello-world');
    expect(slugify('a/b c.d')).toBe('a-b-c-d');
  });

  it('maps falsy input to "item" (the `s || "item"` default), per the prototype', () => {
    // Empty / null / undefined are falsy → default "item" BEFORE slugifying.
    expect(slugify('')).toBe('item');
    expect(slugify(null)).toBe('item');
    expect(slugify(undefined)).toBe('item');
  });

  it('falls back to item-<timestamp> only when a truthy input slugifies to empty', () => {
    // '***' is truthy but all-symbol → '' after cleanup → timestamp fallback.
    expect(slugify('***')).toMatch(/^item-\d+$/);
    expect(slugify('—— ·· ——')).toMatch(/^item-\d+$/);
  });

  it('never exceeds 28 characters (excluding the fallback branch)', () => {
    const long = 'a'.repeat(100);
    expect(slugify(long).length).toBe(28);
  });
});
