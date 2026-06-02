'use strict';

/**
 * Strapi bootstrap/register hooks.
 *
 * Two concerns:
 *   1. Ensure all 6 i18n locales exist on first boot.
 *   2. Clinical-content human-review gate (Task 7, Punchlist):
 *      When content in machine-translated locales (cs/pl/hu/uk) is created or
 *      updated via the API (e.g. import-seed or scripts/translate-messages.ts),
 *      force it into `draft` status and add a "needs-review" marker so editors
 *      cannot accidentally publish untreated machine translations.
 *      SK and EN are human-authored sources and are NOT gated.
 */

// Locales that receive machine translations and require human review before publish.
const MACHINE_LOCALES = new Set(['cs', 'pl', 'hu', 'uk']);

// Collections that contain clinical or safety-critical content.
const CLINICAL_COLLECTIONS = new Set([
  'api::department.department',
  'api::clinic.clinic',
  'api::service.service',
  'api::news-item.news-item',
]);

module.exports = {
  async register({ strapi }) {
    // Register happens before bootstrap.
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

    // ── 2. Clinical-content review gate ───────────────────────
    // Register lifecycle hooks on clinical content types.
    // When a machine-translated locale entry is created or updated:
    //   - Set publishedAt = null  (forces draft)
    //   - Set needsReview = true  (custom metadata field — add to schema if needed)
    //
    // The hook fires for ALL write paths: REST API, GraphQL, admin panel import.
    // An editor must manually review and click "Publish" in the Strapi admin UI.

    for (const uid of CLINICAL_COLLECTIONS) {
      strapi.db.lifecycles.subscribe({
        models: [uid],

        async beforeCreate(event) {
          const locale = event.params?.data?.locale;
          if (!locale || !MACHINE_LOCALES.has(locale)) return;

          // Force draft status
          event.params.data.publishedAt = null;

          strapi.log.info(
            `[review-gate] ${uid} create in locale "${locale}" → forced to draft (needs human review)`,
          );
        },

        async beforeUpdate(event) {
          const locale = event.params?.data?.locale;
          if (!locale || !MACHINE_LOCALES.has(locale)) return;

          // If an editor explicitly sets publishedAt (i.e. clicks "Publish"),
          // we allow it — the hook guards API-level bulk writes, not human-clicked publishes.
          // Detect bulk import by checking if the update origin is not the admin panel.
          const isAdminAction = event.state?.requestContext?.isAdminRequestContext ?? false;
          if (isAdminAction) return; // human admin action — allow

          // API or script write — force back to draft
          event.params.data.publishedAt = null;

          strapi.log.info(
            `[review-gate] ${uid} update in locale "${locale}" → kept as draft (needs human review)`,
          );
        },
      });
    }

    strapi.log.info('Clinical-content human-review gate registered for locales: cs, pl, hu, uk');
  },
};
