'use strict';

/**
 * Strapi bootstrap/register hooks.
 *
 *   1. Ensure all 6 i18n locales exist on first boot.
 *   2. Translation review gate (Sprint A3): machine-translated clinical content
 *      (cs/pl/hu/uk) is ALWAYS a draft. Publishing such an entry is BLOCKED
 *      unless review_status === 'approved'. SK/EN are human-authored and pass
 *      through. No bypass. Mirrors apps/api/src/cms/translation-gate.ts.
 */

const { errors } = require('@strapi/utils');
const { ApplicationError } = errors;

const MACHINE_LOCALES = new Set(['cs', 'pl', 'hu', 'uk']);

// All clinical / safety-critical collections.
const CLINICAL_COLLECTIONS = [
  'api::department.department',
  'api::clinic.clinic',
  'api::physician.physician',
  'api::service.service',
  'api::facility.facility',
  'api::news-item.news-item',
];

module.exports = {
  async register() {
    // no-op
  },

  async bootstrap({ strapi }) {
    // ── 1. Ensure locales ──────────────────────────────────────
    const i18nService = strapi.plugin('i18n').service('locales');
    for (const code of ['cs', 'pl', 'hu', 'uk', 'en']) {
      const existing = await i18nService.findByCode(code);
      if (!existing) {
        await i18nService.create({ code, name: code.toUpperCase() });
        strapi.log.info(`i18n: created locale ${code}`);
      }
    }

    // ── 2. Translation review publish gate ─────────────────────
    for (const uid of CLINICAL_COLLECTIONS) {
      strapi.db.lifecycles.subscribe({
        models: [uid],

        // New machine-translated entries start as drafts.
        async beforeCreate(event) {
          const locale = event.params?.data?.locale;
          if (locale && MACHINE_LOCALES.has(locale)) {
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

          if (!locale || !MACHINE_LOCALES.has(locale)) return; // SK/EN/non-localized: pass
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
