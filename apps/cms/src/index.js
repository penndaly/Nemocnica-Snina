'use strict';

/**
 * Strapi bootstrap/register hooks.
 *
 *   1. Ensure all 6 i18n locales exist on first boot, with `sk` as the default.
 *   2. Translation review gate (Sprint A3): machine-translated clinical content
 *      (cs/pl/hu/uk) is ALWAYS a draft. Publishing such an entry is BLOCKED
 *      unless review_status === 'approved'. SK/EN are human-authored and pass
 *      through. No bypass. Mirrors apps/api/src/cms/translation-gate.ts.
 */

const { errors } = require('@strapi/utils');
const { ApplicationError } = errors;

// Locales whose clinical content needs review_status='approved' to publish.
// Keyed on review state, not translation origin — a human-translated locale
// (Rusyn, Sprint I18N-RUE) gates the same way. Mirrors
// apps/api/src/cms/translation-gate.ts REQUIRES_TRANSLATION_REVIEW.
// Hand-mirrored (apps/cms is npm-managed, no @ns/types workspace dep) —
// keep in step with packages/types REVIEW_GATED_LOCALES.
const REQUIRES_TRANSLATION_REVIEW = new Set(['cs', 'pl', 'hu', 'uk', 'rue']);

// All clinical / safety-critical collections.
const CLINICAL_COLLECTIONS = [
  'api::department.department',
  'api::clinic.clinic',
  'api::physician.physician',
  'api::service.service',
  'api::facility.facility',
  'api::news-item.news-item',
  'api::education-article.education-article',
];

module.exports = {
  async register() {
    // no-op
  },

  async bootstrap({ strapi }) {
    // ── 1. Ensure locales ──────────────────────────────────────
    // The i18n plugin seeds `en` as the store default on first boot and does
    // NOT read `defaultLocale`/`locales` from config/plugins.js (verified
    // against @strapi/plugin-i18n 4.25.0 — those keys are inert). So `sk`
    // must be created here and explicitly made the default, or every entry
    // created without a locale lands in `en` and `locale: 'sk'` writes fail.
    // (CMS-1: this loop used to skip `sk` entirely — unnoticed because the
    // `pluginsOptions` typo meant no collection was localized anyway.)
    const i18nService = strapi.plugin('i18n').service('locales');
    // `rue` (Rusyn) is absent from Strapi 4.25's bundled ISO list, so the
    // admin-UI picker cannot add it; this service path can (verified by
    // scripts/verify-i18n-gate.js). Mirrors packages/types LOCALES.
    const LOCALE_NAMES = { sk: 'Slovenčina', cs: 'Čeština', pl: 'Polski', hu: 'Magyar', uk: 'Українська', en: 'English', rue: 'Русиньскый' };
    for (const code of ['sk', 'cs', 'pl', 'hu', 'uk', 'en', 'rue']) {
      const existing = await i18nService.findByCode(code);
      if (!existing) {
        await i18nService.create({ code, name: LOCALE_NAMES[code] });
        strapi.log.info(`i18n: created locale ${code}`);
      }
    }
    if ((await i18nService.getDefaultLocale()) !== 'sk') {
      await i18nService.setDefaultLocale({ code: 'sk' });
      strapi.log.info('i18n: default locale set to sk');
    }

    // ── 2. Translation review publish gate ─────────────────────
    for (const uid of CLINICAL_COLLECTIONS) {
      strapi.db.lifecycles.subscribe({
        models: [uid],

        // New machine-translated entries start as drafts.
        async beforeCreate(event) {
          const locale = event.params?.data?.locale;
          if (locale && REQUIRES_TRANSLATION_REVIEW.has(locale)) {
            event.params.data.publishedAt = null;
            if (!event.params.data.review_status) event.params.data.review_status = 'needs_review';
          }
        },

        // Block publish of a machine-translated entry unless review_status='approved'.
        async beforeUpdate(event) {
          const data = event.params?.data ?? {};
          const publishing = data.publishedAt != null; // setting publishedAt = publish action
          if (!publishing) return;

          // Resolve locale + review_status (prefer incoming data, else the stored row).
          let locale = data.locale;
          let reviewStatus = data.review_status;
          if (locale === undefined || reviewStatus === undefined) {
            const id = event.params?.where?.id;
            if (id != null) {
              const current = await strapi.db.query(uid).findOne({ where: { id }, select: ['locale', 'review_status'] });
              if (locale === undefined) locale = current?.locale;
              if (reviewStatus === undefined) reviewStatus = current?.review_status;
            }
          }

          if (!locale || !REQUIRES_TRANSLATION_REVIEW.has(locale)) return; // SK/EN/non-localized: pass
          if (reviewStatus !== 'approved') {
            throw new ApplicationError(
              `Cannot publish ${locale} content without review_status='approved'. ` +
                `A reviewer must approve this translation before it can go live ` +
                `(GDPR/clinical-safety requirement — see Admin User Guide §13/§14).`,
            );
          }
        },
      });
    }

    strapi.log.info('Translation review publish gate registered (cs/pl/hu/uk) on 6 clinical collections.');
  },
};
