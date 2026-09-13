/**
 * Translation review gate (Sprint A3) — the canonical publish rule.
 *
 * Clinical content in a review-gated locale (CS/PL/HU/UK today) is ALWAYS a
 * draft: it must not be published unless a reviewer set review_status='approved'.
 * The gate is keyed on the locale, not on how the text was produced — machine
 * output and human translation both go through review. SK/EN are the authored
 * source locales and pass through. Non-clinical collections pass through.
 *
 * This pure logic is the single source of truth; the Strapi beforePublish hook
 * (apps/cms) mirrors it for enforcement at the CMS layer, and the
 * /api/cms/translations approve path calls it. No bypass.
 */
import { REVIEW_GATED_LOCALES } from '@ns/types';

export const CLINICAL_COLLECTIONS = ['departments', 'clinics', 'physicians', 'services', 'facilities', 'news', 'education-articles'] as const;
/**
 * Locales whose *clinical* content must carry review_status='approved' before
 * it can publish. Named for the review state, not the translation origin:
 * today these four are machine-translated, but a human-translated locale
 * (Rusyn, Sprint I18N-RUE) gates exactly the same way. sk/en are the
 * authored source locales and pass through. The list itself lives in
 * @ns/types REVIEW_GATED_LOCALES (I18N-RUE T1, single source); apps/cms
 * mirrors it by hand (no workspace deps there — see the note in index.js).
 */
export const REQUIRES_TRANSLATION_REVIEW = REVIEW_GATED_LOCALES;

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
    'education-article': 'education-articles', 'education-articles': 'education-articles',
  };
  return map[raw] ?? raw;
}

export function isClinicalCollection(collection: string): boolean {
  return (CLINICAL_COLLECTIONS as readonly string[]).includes(normaliseCollection(collection));
}

export function requiresTranslationReview(locale: string): boolean {
  return (REQUIRES_TRANSLATION_REVIEW as readonly string[]).includes(locale);
}

/** True when publishing this entry must be blocked by the review gate. */
export function isPublishBlocked(args: { collection: string; locale: string; reviewStatus?: string }): boolean {
  if (!isClinicalCollection(args.collection)) return false;
  if (!requiresTranslationReview(args.locale)) return false;
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
