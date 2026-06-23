import { isPublishBlocked, assertPublishable, normaliseCollection, TranslationReviewError } from '../translation-gate';

describe('translation review gate', () => {
  it('blocks a CS clinical entry that is not approved', () => {
    expect(isPublishBlocked({ collection: 'departments', locale: 'cs', reviewStatus: 'needs_review' })).toBe(true);
    expect(() => assertPublishable({ collection: 'departments', locale: 'cs', reviewStatus: 'needs_review' }))
      .toThrow(TranslationReviewError);
  });

  it('allows a CS clinical entry once approved', () => {
    expect(isPublishBlocked({ collection: 'departments', locale: 'cs', reviewStatus: 'approved' })).toBe(false);
    expect(() => assertPublishable({ collection: 'departments', locale: 'cs', reviewStatus: 'approved' })).not.toThrow();
  });

  it('never blocks SK/EN (human-authored) regardless of review status', () => {
    expect(isPublishBlocked({ collection: 'departments', locale: 'sk', reviewStatus: 'needs_review' })).toBe(false);
    expect(isPublishBlocked({ collection: 'departments', locale: 'en' })).toBe(false);
  });

  it('never blocks non-clinical collections', () => {
    expect(isPublishBlocked({ collection: 'disclosures', locale: 'cs', reviewStatus: 'needs_review' })).toBe(false);
  });

  it('normalises Strapi uid and singular/plural to a collection key', () => {
    expect(normaliseCollection('api::department.department')).toBe('departments');
    expect(normaliseCollection('news-item')).toBe('news');
    expect(normaliseCollection('clinics')).toBe('clinics');
  });

  it('blocks all four machine locales, passes the rest', () => {
    for (const l of ['cs', 'pl', 'hu', 'uk']) {
      expect(isPublishBlocked({ collection: 'clinics', locale: l, reviewStatus: 'needs_review' })).toBe(true);
    }
    expect(isPublishBlocked({ collection: 'clinics', locale: 'de', reviewStatus: 'needs_review' })).toBe(false);
  });
});
