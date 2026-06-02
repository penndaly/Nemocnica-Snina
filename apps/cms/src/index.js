'use strict';

// Strapi application bootstrap & register hooks.
// Extend here only for cross-cutting concerns (e.g. custom lifecycle hooks,
// seeding initial locales). All content-type logic lives in src/api/.

module.exports = {
  async register({ strapi }) {
    // Register happens before the application is bootstrapped.
  },

  async bootstrap({ strapi }) {
    // Ensure all 6 locales exist in the i18n plugin.
    const locales = ['cs', 'pl', 'hu', 'uk', 'en'];
    const i18nService = strapi.plugin('i18n').service('locales');
    for (const code of locales) {
      const existing = await i18nService.findByCode(code);
      if (!existing) {
        await i18nService.create({ code, name: code.toUpperCase() });
        strapi.log.info(`i18n: created locale ${code}`);
      }
    }
  },
};
