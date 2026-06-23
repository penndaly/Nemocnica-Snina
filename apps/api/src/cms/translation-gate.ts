/**
 * Translation review gate (Sprint A3) — the canonical publish rule.
 *
 * Machine-translated clinical content (CS/PL/HU/UK) is ALWAYS a draft: it must
 * not be published unless a reviewer set review_status='approved'. SK/EN are
 * human-authored and pass through. Non-clinical collections pass through.
 *
 * This pure logic is the single source of truth; the Strapi beforePublish hook
 * (apps/cms) mirrors it for enforcement at the CMS layer, and the
 * /api/cms/translations approve path calls it. No bypass.
 */
export const CLINICAL_COLLECTIONS = ['departments', 'clinics', 'physicians', 'services', 'facilities', 'news'] as const;
export const MACHINE_TRANSLATED_LOCALES = ['cs', 'pl', 'hu', 'uk'] as const;

/** Normalise a Strapi uid ("api::department.department") or plural/singular to a collection key. */
export function normaliseCollection(input: string): string {
  const raw = input.includes('::') ? input.split('.').pop() ?? input : input;
  const map: Record<string, string> = {
    department: 'departments', departments: 'departments',
    clinic: 'clinics', clinics: 'clinics',
    physician: 'physicians', physicians: 'physicians',
    service: 'services', services: 'services',
    facility: 'facilities', facilities: 'facilities',
    'news-item': 'news', 'news-items': 'news', news: 'news',
  };
  return map[raw] ?? raw;
}

export function isClinicalCollection(collection: string): boolean {
  return (CLINICAL_COLLECTIONS as readonly string[]).includes(normaliseCollection(collection));
}

export function isMachineTranslatedLocale(locale: string): boolean {
  return (MACHINE_TRANSLATED_LOCALES as readonly string[]).includes(locale);
}

/** True when publishing this entry must be blocked by the review gate. */
export function isPublishBlocked(args: { collection: string; locale: string; reviewStatus?: string }): boolean {
  if (!isClinicalCollection(args.collection)) return false;
  if (!isMachineTranslatedLocale(args.locale)) return false;
  return args.reviewStatus !== 'approved';
}

export class TranslationReviewError extends Error {
  constructor(locale: string) {
    super(
      `Cannot publish ${locale} content without review_status='approved'. A reviewer must ` +
        `approve this translation before it can go live (GDPR/clinical-safety requirement).`,
    );
    this.name = 'TranslationReviewError';
  }
}

/** Throws TranslationReviewError if the entry is not publishable. */
export function assertPublishable(args: { collection: string; locale: string; reviewStatus?: string }): void {
  if (isPublishBlocked(args)) throw new TranslationReviewError(args.locale);
}
