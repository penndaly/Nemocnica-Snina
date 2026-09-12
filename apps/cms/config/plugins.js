module.exports = ({ env }) => ({
  i18n: {
    enabled: true,
    // NOTE (CMS-1): @strapi/plugin-i18n 4.25 has no `defaultLocale`/`locales`
    // config keys — those were here before and were silently ignored. Locales
    // and the sk default are created by src/index.js bootstrap (the only
    // mechanism that works), and verified by scripts/verify-i18n-gate.js.
  },
  upload: {
    config: {
      // In production, swap for @strapi/provider-upload-aws-s3 or similar EU bucket.
      providerOptions: {
        localServer: {},
      },
      breakpoints: { xlarge: 1920, large: 1000, medium: 750, small: 500, xsmall: 64 },
    },
  },
});
